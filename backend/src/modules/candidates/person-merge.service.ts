import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PersonMergeConflictException, PersonMergeNotFoundException, PersonMergeNotUndoableException, PersonNotFoundException,
} from '../../common/exceptions';
import { AuditLogService } from '../audit-log/audit-log.service';
import { toJsonSafe } from '../../common/util/json-safe';
import { auditIfPersonDeleted } from './person-orphan';

/** Every person column a merge snapshots and an undo recreates (updated_at is left to the database). */
const PERSON_COLUMNS = [
  'id', 'name', 'photo_url', 'gender', 'education', 'date_of_birth', 'bio', 'wikipedia_url', 'caste', 'religion',
  'state_id', 'district_id', 'region_id',
] as const;

/** Identity fields a merge copies from the duplicate into the keeper where the keeper's value is NULL. */
const FILLABLE = ['photo_url', 'gender', 'education', 'date_of_birth', 'bio', 'wikipedia_url', 'caste', 'religion', 'state_id'] as const;

type Row = Record<string, unknown>;
type NotUndoableReason = 'undone' | 'contests_moved' | null;

const jsonEqual = (a: unknown, b: unknown) => JSON.stringify(toJsonSafe(a)) === JSON.stringify(toJsonSafe(b));

/** Person merges: merge a duplicate into a keeper, undo a merge, and a person's merge history (person_merges). */
@Injectable()
export class PersonMergeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Merge the duplicate into the keeper (SUPER_ADMIN; change person also merges, for any editor, when it moves
   * a person's last contest), in one transaction:
   *  1. snapshot the duplicate's row and its candidate ids — the orphan trigger (migration 018) deletes the
   *     duplicate as soon as its last candidate moves;
   *  2. fill the keeper's NULL identity fields from the duplicate (never overwriting a value). District and
   *     region are filled only when the keeper ends up in the duplicate's state;
   *  3. move the candidates still on the duplicate; fewer than were read means one moved meanwhile, so 409
   *     and the transaction rolls back (a duplicate with none is deleted explicitly);
   *  4. log it in person_merges (keeper_ref = keeper, snapshot, candidate ids, filled fields → previous value
   *     null) for undo;
   *  5. one PERSON_MERGE audit row on the keeper.
   */
  async merge(duplicateId: string, keeperId: string, userId?: string) {
    if (duplicateId === keeperId) throw new BadRequestException('source_id and target_id must differ');
    return this.prisma.$transaction((tx) => this.mergeInTx(tx, duplicateId, keeperId, userId));
  }

  /** merge() inside the caller's transaction (change person uses it for a person's last contest). */
  async mergeInTx(tx: Prisma.TransactionClient, duplicateId: string, keeperId: string, userId?: string) {
    const [duplicate, keeper] = await Promise.all([
      tx.persons.findUnique({ where: { id: duplicateId } }),
      tx.persons.findUnique({ where: { id: keeperId } }),
    ]);
    if (!duplicate) throw new PersonNotFoundException(duplicateId);
    if (!keeper) throw new PersonNotFoundException(keeperId);
    const snapshot = toJsonSafe(Object.fromEntries(PERSON_COLUMNS.map((c) => [c, duplicate[c]]))) as Row;
    const candidateIds = (await tx.candidates.findMany({ where: { person_id: duplicateId }, select: { id: true } })).map((c) => c.id);

    const fill: Row = {};
    for (const f of FILLABLE) if (keeper[f] == null && duplicate[f] != null) fill[f] = duplicate[f];
    const keeperState = keeper.state_id ?? duplicate.state_id;
    if (keeperState != null && keeperState === duplicate.state_id) {
      for (const f of ['district_id', 'region_id'] as const) if (keeper[f] == null && duplicate[f] != null) fill[f] = duplicate[f];
    }
    const filledFields = Object.fromEntries(Object.keys(fill).map((f) => [f, null]));
    if (Object.keys(fill).length) await tx.persons.update({ where: { id: keeperId }, data: fill as Prisma.personsUncheckedUpdateInput });

    if (candidateIds.length) {
      const { count } = await tx.candidates.updateMany({ where: { id: { in: candidateIds }, person_id: duplicateId }, data: { person_id: keeperId } });
      if (count !== candidateIds.length) throw new PersonMergeConflictException({ expected: candidateIds.length, moved: count });
    }
    // The orphan trigger has already deleted a duplicate that had candidates; this covers one with none.
    await tx.persons.deleteMany({ where: { id: duplicateId } });

    const log = await tx.person_merges.create({
      data: {
        keeper_id: keeperId, keeper_ref: keeperId, duplicate: snapshot as Prisma.InputJsonValue, candidate_ids: candidateIds,
        filled_fields: filledFields, merged_by: userId ?? null,
      },
      select: { id: true },
    });
    await this.audit.record(
      {
        userId, action: 'PERSON_MERGE', entityType: 'person', entityId: keeperId,
        oldValue: { source_id: duplicateId, source_name: duplicate.name },
        newValue: { target_id: keeperId, merge_id: log.id, candidates_moved: candidateIds.length, filled_fields: Object.keys(fill) },
      },
      tx,
    );
    return { merged: true, target_id: keeperId, merge_id: log.id };
  }

  /**
   * Undo a merge (SUPER_ADMIN), in one transaction, all or nothing:
   *  - 404 for an unknown merge; 409 when it was already undone, when no person with id keeper_ref exists
   *    (merged away or emptied later, and not brought back by undoing that), or when any logged candidate no
   *    longer belongs to the keeper (the message names them);
   *  - recreate the duplicate with its original id and fields, and re-point keeper_id on older merges kept on
   *    it (keeper_ref), so a chain of merges can be undone newest first;
   *  - restore the keeper's filled fields to NULL, only where the keeper still holds the value the merge put there;
   *  - move the logged candidates back (only rows still on the keeper; a short count is a 409 and rolls back),
   *    mark the merge undone and write PERSON_MERGE_UNDO on the keeper.
   * A keeper that had no candidates of its own is left empty and deleted by the trigger (PERSON_DELETE).
   */
  async undoMerge(mergeId: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const log = await tx.person_merges.findUnique({ where: { id: mergeId } });
      if (!log) throw new PersonMergeNotFoundException(mergeId);
      if (log.undone_at) throw new PersonMergeNotUndoableException('This merge has already been undone.', { merge_id: mergeId });
      const keeperId = log.keeper_ref;
      const keeper = await tx.persons.findUnique({ where: { id: keeperId } });
      if (!keeper) {
        throw new PersonMergeNotUndoableException(
          'The person this merge was kept on no longer exists (it was merged or deleted later), so the merge can\'t be undone.',
          { merge_id: mergeId },
        );
      }
      // Claim the undo first: a concurrent undo then finds no row to claim; any later throw rolls the claim back.
      const claimed = await tx.person_merges.updateMany({
        where: { id: mergeId, undone_at: null },
        data: { undone_at: new Date(), undone_by: userId ?? null },
      });
      if (!claimed.count) throw new PersonMergeNotUndoableException('This merge has already been undone.', { merge_id: mergeId });

      const ids = log.candidate_ids;
      const rows = await tx.candidates.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, person_id: true } });
      const moved = rows.filter((r) => r.person_id !== keeperId);
      const missing = ids.filter((id) => !rows.some((r) => r.id === id));
      if (moved.length || missing.length) {
        const named = [...moved.map((r) => r.name), ...missing.map((id) => `deleted candidate ${id}`)];
        throw new PersonMergeNotUndoableException(
          `Can't undo this merge: ${named.join(', ')} ${named.length === 1 ? 'no longer belongs' : 'no longer belong'} to this person.`,
          { merge_id: mergeId, moved: moved.map(({ id, name }) => ({ id, name })), missing },
        );
      }

      const snapshot = log.duplicate as Row;
      const filled = Object.keys((log.filled_fields as Row | null) ?? {});

      const data = Object.fromEntries(PERSON_COLUMNS.filter((c) => c in snapshot).map((c) => [c, snapshot[c]])) as Row;
      if (typeof data.date_of_birth === 'string') data.date_of_birth = new Date(data.date_of_birth);
      await tx.persons.create({ data: data as Prisma.personsUncheckedCreateInput });
      // Merges kept on the recreated person lost keeper_id (SET NULL) when it was merged away: point them back.
      await tx.person_merges.updateMany({ where: { keeper_ref: snapshot.id as string }, data: { keeper_id: snapshot.id as string } });

      const restore = filled.filter((f) => jsonEqual(keeper[f as keyof typeof keeper], snapshot[f]));
      let keeperAfter: Row = keeper;
      if (restore.length) {
        keeperAfter = await tx.persons.update({
          where: { id: keeperId },
          data: Object.fromEntries(restore.map((f) => [f, null])) as Prisma.personsUncheckedUpdateInput,
        });
      }

      if (ids.length) {
        const { count } = await tx.candidates.updateMany({ where: { id: { in: ids }, person_id: keeperId }, data: { person_id: snapshot.id as string } });
        if (count !== ids.length) {
          throw new PersonMergeNotUndoableException(
            "Some of this merge's contests moved to another person while undoing, so nothing was undone. Try again.",
            { merge_id: mergeId, expected: ids.length, moved: count },
          );
        }
      }
      await this.audit.record(
        {
          userId, action: 'PERSON_MERGE_UNDO', entityType: 'person', entityId: keeperId,
          oldValue: { merge_id: mergeId, target_id: keeperId },
          newValue: { source_id: snapshot.id, source_name: snapshot.name, candidates_moved: ids.length, restored_fields: restore },
        },
        tx,
      );
      await auditIfPersonDeleted(tx, this.audit, keeperAfter as Row & { id: string }, userId);
      return { undone: true, merge_id: mergeId, person_id: snapshot.id as string, keeper_id: keeperId };
    });
  }

  /**
   * Merges into this person, newest first, undone ones included. `undoable`: not undone yet and every
   * logged candidate still belongs to the person (`currentCandidateIds`, the person's candidates now).
   */
  async mergeHistory(personId: string, currentCandidateIds: string[]) {
    const rows = await this.prisma.person_merges.findMany({
      where: { keeper_ref: personId },
      orderBy: { merged_at: 'desc' },
      select: { id: true, duplicate: true, candidate_ids: true, merged_at: true, undone_at: true, merger: { select: { name: true } } },
    });
    const current = new Set(currentCandidateIds);
    return rows.map((m) => ({
      id: m.id,
      duplicate_name: String((m.duplicate as Row | null)?.name ?? ''),
      candidate_count: m.candidate_ids.length,
      merged_at: m.merged_at,
      merged_by: m.merger?.name ?? null,
      undoable: !m.undone_at && m.candidate_ids.every((id) => current.has(id)),
      undone_at: m.undone_at,
      // The keeper is the person being viewed, so it exists (the undo itself checks that keeper_ref still does).
      not_undoable_reason: (m.undone_at ? 'undone' : m.candidate_ids.every((id) => current.has(id)) ? null : 'contests_moved') as NotUndoableReason,
    }));
  }
}
