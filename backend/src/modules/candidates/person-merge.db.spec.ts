/**
 * Merge, undo, change person and split against the local database, with the migration 018 triggers live:
 * the orphan trigger that deletes an emptied person and the deferred "every candidate has a person" check.
 * The real services run inside one rolled-back transaction: their `$transaction` becomes a savepoint, so a
 * refused undo rolls back exactly as it would in production. Each body ends with SET CONSTRAINTS ALL
 * IMMEDIATE so the deferred check runs before the rollback.
 *
 * Without a reachable database the tests print a "SKIPPED" warning and pass; REQUIRE_DB_TESTS=1 makes a
 * missing database a failure (as in person-required.db.spec.ts).
 */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PersonMergeService } from './person-merge.service';
import { PersonsService } from './persons.service';
import { CandidatesService } from './candidates.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ValidationPipe } from '@nestjs/common';
import { UpdateCandidateDto } from './dto/candidate-input.dto';

config({ path: join(__dirname, '../../../.env') });

class Rollback extends Error {}

const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

interface Seat { const_id: string; election_id: string; state_id: number | null }

/** Every person column but updated_at, which an undo leaves to the database. */
const COLUMNS = ['id', 'name', 'photo_url', 'gender', 'education', 'date_of_birth', 'bio', 'wikipedia_url', 'caste', 'religion', 'state_id', 'district_id', 'region_id'];

describe('person merge, undo, change person and split (DB)', () => {
  let prisma: PrismaClient | null = null;
  let seat: Seat | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      await client.$queryRaw`SELECT 1 FROM person_merges LIMIT 1`;
      [seat] = await client.$queryRaw<Seat[]>`
        SELECT id AS const_id, election_id, state_id FROM constituencies WHERE state_id IS NOT NULL ORDER BY id LIMIT 1`;
      prisma = client;
    } catch {
      await client.$disconnect();
    }
  });

  afterAll(async () => prisma?.$disconnect());

  function unavailable(name: string): boolean {
    if (prisma && seat) return false;
    if (REQUIRE_DB) throw new Error(`REQUIRE_DB_TESTS=1 but no database with migration 018 and seed data is reachable (${name})`);
    console.warn(`SKIPPED (no database with migration 018 and seed data): ${name}`);
    return true;
  }

  /** The services on the test transaction; their own `$transaction` runs as a savepoint inside it. */
  function services(tx: any) {
    let n = 0;
    const client = new Proxy(tx, {
      get(target, key) {
        if (key !== '$transaction') return target[key];
        return async (fn: (t: unknown) => Promise<unknown>) => {
          const sp = `svc_${++n}`;
          await target.$executeRawUnsafe(`SAVEPOINT ${sp}`);
          try {
            const out = await fn(target);
            await target.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
            return out;
          } catch (err) {
            await target.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
            throw err;
          }
        };
      },
    });
    const audit = new AuditLogService(client as any);
    const persons = new PersonMergeService(client as any, audit);
    return { persons, personRecords: new PersonsService(client as any, audit), candidates: new CandidatesService(client as any, {} as any, audit, persons) };
  }

  async function inRollbackTx(name: string, body: (tx: any, s: Seat) => Promise<void>) {
    if (unavailable(name)) return;
    const s = seat!;
    await prisma!
      .$transaction(async (tx) => {
        await body(tx, s);
        await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
        throw new Rollback();
      }, { timeout: 30_000 })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
  }

  const person = async (tx: any, id: string) => {
    const row = await tx.persons.findUnique({ where: { id } });
    return row ? Object.fromEntries(COLUMNS.map((c) => [c, row[c]])) : null;
  };
  const personOf = async (tx: any, candidateId: string) =>
    (await tx.candidates.findUnique({ where: { id: candidateId }, select: { person_id: true } }))?.person_id;
  const auditActions = async (tx: any, entityIds: string[]) =>
    (await tx.audit_logs.findMany({ where: { entity_id: { in: entityIds } }, orderBy: { timestamp: 'asc' }, select: { action: true, entity_id: true } }))
      .map((a: any) => `${a.action}:${a.entity_id}`);

  /** A keeper with one contest and a duplicate with two, plus fields on both sides. */
  async function setup(tx: any, s: Seat) {
    const keeper = await tx.persons.create({ data: { name: 'TEST MERGE KEEPER', gender: 'M', bio: 'keeper bio', state_id: s.state_id } });
    const duplicate = await tx.persons.create({
      data: {
        name: 'TEST MERGE DUP', gender: 'F', bio: 'dup bio', caste: 'Test caste', religion: 'Test religion',
        date_of_birth: new Date('1961-04-05'), wikipedia_url: 'https://en.wikipedia.org/wiki/Test', state_id: s.state_id,
      },
    });
    const cand = (name: string, person_id: string) =>
      tx.candidates.create({ data: { name, person_id, election_id: s.election_id, const_id: s.const_id, party_id: 'IND' }, select: { id: true, name: true } });
    const k1 = await cand('TEST MERGE K1', keeper.id);
    const d1 = await cand('TEST MERGE D1', duplicate.id);
    const d2 = await cand('TEST MERGE D2', duplicate.id);
    return { keeper, duplicate, k1, d1, d2 };
  }

  it('merge, then undo, restores the record exactly: same id, fields and contests; the keeper\'s filled fields reverted', async () => {
    await inRollbackTx('round trip', async (tx, s) => {
      const { persons } = services(tx);
      const { keeper, duplicate, k1, d1, d2 } = await setup(tx, s);
      const keeperBefore = await person(tx, keeper.id);
      const duplicateBefore = await person(tx, duplicate.id);

      const { merge_id } = await persons.merge(duplicate.id, keeper.id);
      // The orphan trigger deleted the duplicate as its last candidate moved.
      expect(await person(tx, duplicate.id)).toBeNull();
      expect([await personOf(tx, d1.id), await personOf(tx, d2.id), await personOf(tx, k1.id)]).toEqual([keeper.id, keeper.id, keeper.id]);
      // Only NULL fields were filled; gender and bio were the keeper's own.
      expect(await person(tx, keeper.id)).toEqual({
        ...keeperBefore, caste: 'Test caste', religion: 'Test religion', date_of_birth: new Date('1961-04-05'),
        wikipedia_url: 'https://en.wikipedia.org/wiki/Test',
      });

      await expect(persons.undoMerge(merge_id)).resolves.toMatchObject({ undone: true, person_id: duplicate.id });
      expect(await person(tx, duplicate.id)).toEqual(duplicateBefore);
      expect(await person(tx, keeper.id)).toEqual(keeperBefore);
      expect([await personOf(tx, d1.id), await personOf(tx, d2.id), await personOf(tx, k1.id)]).toEqual([duplicate.id, duplicate.id, keeper.id]);
      const log = await tx.person_merges.findUnique({ where: { id: merge_id } });
      expect(log.undone_at).not.toBeNull();
      expect(await auditActions(tx, [keeper.id])).toEqual([`PERSON_MERGE:${keeper.id}`, `PERSON_MERGE_UNDO:${keeper.id}`]);

      // Once only.
      await expect(persons.undoMerge(merge_id)).rejects.toMatchObject({ status: 409 });
    });
  });

  it('undo leaves a field the keeper changed after the merge alone', async () => {
    await inRollbackTx('edited keeper', async (tx, s) => {
      const { persons, personRecords } = services(tx);
      const { keeper, duplicate } = await setup(tx, s);
      const { merge_id } = await persons.merge(duplicate.id, keeper.id);
      await personRecords.update(keeper.id, { caste: 'Edited caste' });
      await persons.undoMerge(merge_id);
      expect(await person(tx, keeper.id)).toMatchObject({ caste: 'Edited caste', religion: null, date_of_birth: null, wikipedia_url: null });
    });
  });

  it('undo after a later move is refused with 409 naming the candidate, and nothing is restored', async () => {
    await inRollbackTx('refused undo', async (tx, s) => {
      const { persons, candidates } = services(tx);
      const { keeper, duplicate, d1, d2 } = await setup(tx, s);
      const other = await tx.persons.create({ data: { name: 'TEST MERGE OTHER' } });
      const { merge_id } = await persons.merge(duplicate.id, keeper.id);
      await candidates.changePerson(d1.id, other.id);
      const keeperAfterMerge = await person(tx, keeper.id);

      const err = await persons.undoMerge(merge_id).catch((e) => e);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().message).toContain('TEST MERGE D1');
      expect(err.getResponse().message).not.toContain('TEST MERGE D2');
      // No partial restore.
      expect(await person(tx, duplicate.id)).toBeNull();
      expect(await person(tx, keeper.id)).toEqual(keeperAfterMerge);
      expect([await personOf(tx, d1.id), await personOf(tx, d2.id)]).toEqual([other.id, keeper.id]);
      expect((await tx.person_merges.findUnique({ where: { id: merge_id } })).undone_at).toBeNull();
    });
  });

  it('undo is refused with 409 while the keeper itself is merged away (keeper_id NULL, keeper_ref kept)', async () => {
    await inRollbackTx('keeper gone', async (tx, s) => {
      const { persons } = services(tx);
      const { keeper, duplicate } = await setup(tx, s);
      const final = await tx.persons.create({ data: { name: 'TEST MERGE FINAL' } });
      const { merge_id } = await persons.merge(duplicate.id, keeper.id);
      await persons.merge(keeper.id, final.id);
      expect(await tx.person_merges.findUnique({ where: { id: merge_id } })).toMatchObject({ keeper_id: null, keeper_ref: keeper.id });
      await expect(persons.undoMerge(merge_id)).rejects.toMatchObject({ status: 409 });
    });
  });

  it('chained merges undo newest first: X into K, K into Z, undo K into Z, then undo X into K', async () => {
    await inRollbackTx('chain', async (tx, s) => {
      const { persons } = services(tx);
      // X = duplicate (d1, d2), K = keeper (k1); Z has a contest of its own, so undoing K into Z leaves it in place.
      const { keeper: k, duplicate: x, k1, d1, d2 } = await setup(tx, s);
      const z = await tx.persons.create({ data: { name: 'TEST MERGE Z', state_id: s.state_id } });
      const z1 = await tx.candidates.create({
        data: { name: 'TEST MERGE Z1', person_id: z.id, election_id: s.election_id, const_id: s.const_id, party_id: 'IND' }, select: { id: true },
      });
      const [xBefore, kBefore, zBefore] = [await person(tx, x.id), await person(tx, k.id), await person(tx, z.id)];

      const first = await persons.merge(x.id, k.id);
      const second = await persons.merge(k.id, z.id);
      expect(await tx.person_merges.findUnique({ where: { id: first.merge_id } })).toMatchObject({ keeper_id: null, keeper_ref: k.id });
      expect(await persons.mergeHistory(k.id, [d1.id, d2.id, k1.id])).toMatchObject([{ id: first.merge_id, undoable: true }]);

      await expect(persons.undoMerge(second.merge_id)).resolves.toMatchObject({ undone: true, person_id: k.id, keeper_id: z.id });
      // K is back, and the older merge points at it again.
      expect(await tx.person_merges.findUnique({ where: { id: first.merge_id } })).toMatchObject({ keeper_id: k.id, keeper_ref: k.id });
      expect([await personOf(tx, d1.id), await personOf(tx, d2.id), await personOf(tx, k1.id), await personOf(tx, z1.id)])
        .toEqual([k.id, k.id, k.id, z.id]);

      await expect(persons.undoMerge(first.merge_id)).resolves.toMatchObject({ undone: true, person_id: x.id, keeper_id: k.id });
      expect([await person(tx, x.id), await person(tx, k.id), await person(tx, z.id)]).toEqual([xBefore, kBefore, zBefore]);
      expect([await personOf(tx, d1.id), await personOf(tx, d2.id), await personOf(tx, k1.id), await personOf(tx, z1.id)])
        .toEqual([x.id, x.id, k.id, z.id]);
      for (const id of [first.merge_id, second.merge_id]) {
        expect((await tx.person_merges.findUnique({ where: { id } })).undone_at).not.toBeNull();
      }
    });
  });

  it("change person of a person's last contest merges it into the target: logged, fields filled, undoable", async () => {
    await inRollbackTx('change person merge', async (tx, s) => {
      const { candidates, persons } = services(tx);
      const { keeper, k1, duplicate, d1, d2 } = await setup(tx, s);
      await tx.persons.update({ where: { id: keeper.id }, data: { education: 'Graduate' } });
      const [keeperBefore, targetBefore] = [await person(tx, keeper.id), await person(tx, duplicate.id)];

      // k1 is the keeper's only contest: moving it merges the keeper into the duplicate.
      const out = await candidates.changePerson(k1.id, duplicate.id);
      expect(out).toMatchObject({ person_id: duplicate.id, old_person_deleted: true, merge_id: expect.any(String) });
      expect(await person(tx, keeper.id)).toBeNull();
      expect(await person(tx, duplicate.id)).toEqual({ ...targetBefore, education: 'Graduate' });
      expect(await tx.person_merges.findUnique({ where: { id: out.merge_id } })).toMatchObject({
        keeper_ref: duplicate.id, candidate_ids: [k1.id], filled_fields: { education: null },
      });
      expect(await auditActions(tx, [k1.id, keeper.id, duplicate.id])).toEqual([`PERSON_MERGE:${duplicate.id}`, `CANDIDATE_LINK_PERSON:${k1.id}`]);

      await expect(persons.undoMerge(out.merge_id!)).resolves.toMatchObject({ undone: true, person_id: keeper.id });
      expect([await person(tx, keeper.id), await person(tx, duplicate.id)]).toEqual([keeperBefore, targetBefore]);
      expect([await personOf(tx, k1.id), await personOf(tx, d1.id), await personOf(tx, d2.id)]).toEqual([keeper.id, duplicate.id, duplicate.id]);
    });
  });

  it('change person of one of several contests is a plain move: no merge log, the old person kept', async () => {
    await inRollbackTx('change person move', async (tx, s) => {
      const { candidates } = services(tx);
      const { keeper, duplicate, d1 } = await setup(tx, s);
      await expect(candidates.changePerson(d1.id, keeper.id)).resolves.toMatchObject({ person_id: keeper.id, old_person_deleted: false, merge_id: null });
      expect(await person(tx, duplicate.id)).not.toBeNull();
      expect(await tx.person_merges.count({ where: { keeper_ref: keeper.id } })).toBe(0);
      expect(await auditActions(tx, [d1.id, duplicate.id, keeper.id])).toEqual([`CANDIDATE_LINK_PERSON:${d1.id}`]);
    });
  });

  it("split: a new person from the ballot name and seat state, the old person kept; the person's only contest is refused with 409", async () => {
    await inRollbackTx('split', async (tx, s) => {
      const { candidates } = services(tx);
      const { keeper, k1, duplicate, d1 } = await setup(tx, s);

      const a = await candidates.split(d1.id);
      expect(a.old_person_deleted).toBe(false);
      expect(await person(tx, duplicate.id)).not.toBeNull();
      expect(await person(tx, a.person_id)).toMatchObject({ name: 'TEST MERGE D1', state_id: s.state_id });
      expect(await personOf(tx, d1.id)).toBe(a.person_id);

      // k1 is the keeper's only contest.
      const keeperBefore = await person(tx, keeper.id);
      const err = await candidates.split(k1.id).catch((e) => e);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().message).toBe("This is the person's only contest");
      expect(await person(tx, keeper.id)).toEqual(keeperBefore);
      expect(await personOf(tx, k1.id)).toBe(keeper.id);
      expect(await auditActions(tx, [d1.id, k1.id, keeper.id])).toEqual([`CANDIDATE_SPLIT:${d1.id}`]);
    });
  });

  it('assets and liabilities (BigInt) round-trip through update and its audit row', async () => {
    await inRollbackTx('bigint', async (tx, s) => {
      const { candidates } = services(tx);
      const { k1 } = await setup(tx, s);
      // The body as a request delivers it: a DTO class instance from the global ValidationPipe.
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
      const body = await pipe.transform({ assets: 125000000000, liabilities: 0, age: 51, criminal_cases: 0 }, { type: 'body', metatype: UpdateCandidateDto });
      expect(body).toBeInstanceOf(UpdateCandidateDto);
      const updated = await candidates.update(k1.id, body);
      expect(updated).toMatchObject({ assets: BigInt(125000000000), liabilities: BigInt(0), age: 51, criminal_cases: 0 });
      const row = await tx.audit_logs.findFirst({ where: { action: 'CANDIDATE_UPDATE', entity_id: k1.id } });
      expect(row.new_value).toEqual({ assets: 125000000000, liabilities: 0, age: 51, criminal_cases: 0 });
    });
  });
});
