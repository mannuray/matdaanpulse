import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CandidateNotFoundException, CandidateSoleContestException, ConstituencyNotFoundException, ElectionFinalizedException, ElectionNotFoundException, PersonNotFoundException,
} from '../../common/exceptions';
import { ResultChangeNotifier } from '../live/result-change-notifier';
import { AuditLogService } from '../audit-log/audit-log.service';
import { changedFields, createdFields } from '../audit-log/audit-diff';
import { seatResult } from './seat-result';
import { auditIfPersonDeleted } from './person-orphan';
import { PersonsService } from './persons.service';
import type { CreateCandidateDto, UpdateCandidateDto } from './dto/candidate-input.dto';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: ResultChangeNotifier,
    private readonly audit: AuditLogService,
    private readonly persons: PersonsService,
  ) {}

  /** `includeAffidavit` is for the admin list only (the affidavit columns); the public list never selects them. */
  findAll(filters?: { election_id?: string; const_id?: string }, take = 1000, includeAffidavit = false) {
    return this.prisma.candidates.findMany({
      where: {
        election_id: filters?.election_id,
        const_id: filters?.const_id,
      },
      take,
      select: {
        id: true,
        name: true,
        party_id: true,
        const_id: true,
        is_incumbent: true,
        // Every candidate has a person (migration 018); the admin list and the public summary both link to it.
        person_id: true,
        ...(includeAffidavit ? { age: true, assets: true, liabilities: true, criminal_cases: true } : {}),
        parties: {
          select: {
            id: true,
            name: true,
            color: true,
            abbreviation: true
          }
        },
        constituencies: {
          select: {
            id: true,
            name: true,
          }
        },
        persons: {
          select: {
            id: true,
            name: true,
            photo_url: true
          }
        }
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const candidate = await this.prisma.candidates.findUnique({
      where: { id },
      include: {
        parties: true,
        constituencies: true,
        persons: true,
        elections: true,
      },
    });
    if (!candidate) throw new CandidateNotFoundException(id);
    return candidate;
  }

  /** A person's candidacies across elections: the count and the earliest election year (null with none). */
  async personContests(personId: string): Promise<{ contests: number; first_year: number | null }> {
    const rows = await this.prisma.candidates.findMany({ where: { person_id: personId }, select: { elections: { select: { year: true } } } });
    const years = rows.map((r) => r.elections.year);
    return { contests: rows.length, first_year: years.length ? Math.min(...years) : null };
  }

  /** The candidate's result in its seat plus every candidate of that seat (see `seatResult` in seat-result.ts). */
  async seatResult(id: string) {
    const candidate = await this.prisma.candidates.findUnique({
      where: { id },
      select: { id: true, const_id: true, election_id: true, elections: { select: { status: true } } },
    });
    if (!candidate) throw new CandidateNotFoundException(id);
    const seat = await this.prisma.candidates.findMany({
      where: { const_id: candidate.const_id, election_id: candidate.election_id },
      select: { id: true, name: true, party_id: true, results: { select: { votes: true, status: true, margin: true }, take: 1 } },
    });
    return seatResult(candidate.id, candidate.elections.status === 'Finalized', seat);
  }

  findByName(name: string, election_id?: string, limit = 20) {
    return this.prisma.candidates.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
        election_id: election_id,
      },
      include: {
        parties: true,
        constituencies: true,
        persons: true,
      },
      take: limit,
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * New candidate in a seat of its election, plus its zero-vote results row (status TRAILING) so it shows
   * up in the Live Console. One transaction: a seat of another election writes nothing (404).
   */
  /**
   * New candidate plus its zero-vote results row, in one transaction (a Finalized election is refused with 409).
   * After the commit the same steps as a result override run (live-version memo, cache purge, admin SSE event),
   * so the new row shows up; a failure there is logged and never fails the request.
   */
  async create(data: CreateCandidateDto, userId?: string) {
    const { candidate, result } = await this.prisma.$transaction(async (tx) => {
      const election = await tx.elections.findUnique({ where: { id: data.election_id }, select: { status: true } });
      if (!election) throw new ElectionNotFoundException(data.election_id);
      if (election.status === 'Finalized') throw new ElectionFinalizedException(data.election_id);
      const seat = await tx.constituencies.findFirst({
        where: { id: data.const_id, election_id: data.election_id },
        select: { id: true, state_id: true },
      });
      if (!seat) throw new ConstituencyNotFoundException(data.const_id);
      // Every candidate has a person (migration 018): without one, create it from the ballot name and the seat's state.
      if (data.person_id && !(await tx.persons.findUnique({ where: { id: data.person_id }, select: { id: true } }))) {
        throw new PersonNotFoundException(data.person_id);
      }
      const person_id = data.person_id
        ?? (await tx.persons.create({ data: { name: data.name, state_id: seat.state_id }, select: { id: true } })).id;
      const candidate = await tx.candidates.create({
        data: { ...data, person_id } as Prisma.candidatesUncheckedCreateInput,
      });
      const result = await tx.results.create({
        data: {
          candidate_id: candidate.id,
          const_id: candidate.const_id,
          election_id: candidate.election_id,
          votes: 0,
          status: 'TRAILING',
          margin: 0,
        },
      });
      await this.audit.record(
        { userId, action: 'CANDIDATE_CREATE', entityType: 'candidate', entityId: candidate.id, newValue: createdFields(candidate) },
        tx,
      );
      return { candidate, result };
    });

    try {
      await this.notifier.afterCommit(
        result.election_id,
        candidate.party_id ? [{ const_id: result.const_id, p: candidate.party_id, m: result.margin ?? 0, s: result.status, r: result.round_no ?? undefined }] : [],
        { kind: 'single', ...(!candidate.party_id && { skippedMissingParty: { resultId: result.id } }) },
      );
    } catch (err) {
      this.logger.warn(`Post-commit steps failed for new candidate ${candidate.id}: ${(err as Error).message}`);
    }
    return candidate;
  }

  async update(id: string, data: UpdateCandidateDto, userId?: string) {
    const candidate = await this.prisma.candidates.findUnique({ where: { id } });
    if (!candidate) throw new CandidateNotFoundException(id);
    const updated = await this.prisma.candidates.update({
      where: { id },
      data: data as Prisma.candidatesUncheckedUpdateInput,
    });
    const diff = changedFields(candidate, updated);
    if (diff) await this.audit.record({ userId, action: 'CANDIDATE_UPDATE', entityType: 'candidate', entityId: id, ...diff });
    return updated;
  }

  /**
   * Change person: move this candidacy to another existing person (CANDIDATE_LINK_PERSON). The same person
   * is a no-op with no audit row. One transaction.
   *  - When it is the old person's last contest, the move is a merge of the old person into the target
   *    (PersonsService.mergeInTx): logged in person_merges, the target's empty fields filled, undoable by a
   *    super admin from the target's merge history. `merge_id` is set and `old_person_deleted` is true.
   *  - Otherwise it is a plain move (`merge_id` null). Should a concurrent move have emptied the old person
   *    anyway, the orphan trigger deletes it and PERSON_DELETE records its last state.
   */
  async changePerson(candidateId: string, personId: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.candidates.findUnique({ where: { id: candidateId } });
      if (!candidate) throw new CandidateNotFoundException(candidateId);
      if (candidate.person_id === personId) return { ...candidate, old_person_deleted: false, merge_id: null };
      const person = await tx.persons.findUnique({ where: { id: personId }, select: { id: true } });
      if (!person) throw new PersonNotFoundException(personId);
      const link = (merge_id?: string) => this.audit.record(
        {
          userId, action: 'CANDIDATE_LINK_PERSON', entityType: 'candidate', entityId: candidateId,
          oldValue: { person_id: candidate.person_id }, newValue: { person_id: personId, ...(merge_id && { merge_id }) },
        },
        tx,
      );

      if ((await tx.candidates.count({ where: { person_id: candidate.person_id } })) <= 1) {
        const { merge_id } = await this.persons.mergeInTx(tx, candidate.person_id, personId, userId);
        await link(merge_id);
        const moved = await tx.candidates.findUnique({ where: { id: candidateId } });
        return { ...moved!, old_person_deleted: true, merge_id };
      }

      const before = await tx.persons.findUnique({ where: { id: candidate.person_id } });
      const updated = await tx.candidates.update({ where: { id: candidateId }, data: { person_id: personId } });
      await link();
      const old_person_deleted = await auditIfPersonDeleted(tx, this.audit, before, userId);
      return { ...updated, old_person_deleted, merge_id: null };
    });
  }

  /**
   * Split: move this candidacy to a new person made from it (the ballot name and the seat's state), with
   * CANDIDATE_SPLIT. 409 when it is the person's only contest. PERSON_DELETE too should a concurrent move
   * have left the old person without candidates. One transaction.
   */
  async split(candidateId: string, userId?: string): Promise<{ person_id: string; old_person_deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.candidates.findUnique({
        where: { id: candidateId },
        select: { id: true, name: true, person_id: true, constituencies: { select: { state_id: true } } },
      });
      if (!candidate) throw new CandidateNotFoundException(candidateId);
      // Splitting the only contest would just replace the person with a copy of it.
      if ((await tx.candidates.count({ where: { person_id: candidate.person_id } })) <= 1) {
        throw new CandidateSoleContestException(candidateId);
      }
      const before = await tx.persons.findUnique({ where: { id: candidate.person_id } });
      const person = await tx.persons.create({
        data: { name: candidate.name, state_id: candidate.constituencies.state_id },
        select: { id: true },
      });

      await tx.candidates.update({ where: { id: candidateId }, data: { person_id: person.id } });
      await this.audit.record(
        {
          userId, action: 'CANDIDATE_SPLIT', entityType: 'candidate', entityId: candidateId,
          oldValue: { person_id: candidate.person_id }, newValue: { person_id: person.id },
        },
        tx,
      );
      const old_person_deleted = await auditIfPersonDeleted(tx, this.audit, before, userId);
      return { person_id: person.id, old_person_deleted };
    });
  }
}
