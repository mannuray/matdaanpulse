/**
 * Integration check of migration 018 (every candidate has a person) against the local database:
 * the AFTER INSERT trigger that creates a person, the deferred check that no candidate commits
 * without one, the trigger that deletes a person left without candidates, and a re-run of the
 * migration being a no-op. Every change is rolled back, except in the commit test, which must fail.
 *
 * Without a reachable database the tests print a "SKIPPED" warning and pass; REQUIRE_DB_TESTS=1
 * makes a missing database a failure (as in live-version.db.spec.ts). The re-run test also needs
 * `psql` on the PATH (it runs the migration file the way setup.sh does).
 */
import { config } from 'dotenv';
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: join(__dirname, '../../../.env') });

class Rollback extends Error {}

const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';
const MIGRATION = join(__dirname, '../../../../database/migrations/018_person_required.sql');
/** The deferred check raises not_null_violation on person_id, which Prisma reports as a null constraint. */
const NULL_PERSON = /Null constraint (failed|violation)[^\n]*person_id|has no person/;

interface Seat { const_id: string; election_id: string; state_id: number | null }

describe('migration 018: every candidate has a person (DB)', () => {
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

  async function inRollbackTx(name: string, body: (tx: any, s: Seat) => Promise<void>) {
    if (unavailable(name)) return;
    const s = seat!;
    await prisma!
      .$transaction(async (tx) => {
        await body(tx, s);
        throw new Rollback();
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
  }

  /** Inserts a candidate without a person (as the seeds do) and returns its id and person_id. */
  async function insertCandidate(tx: any, s: Seat, name: string, personId: string | null = null) {
    const [row] = await tx.$queryRaw`
      INSERT INTO candidates (person_id, election_id, const_id, party_id, name, is_incumbent)
      VALUES (${personId}::uuid, ${s.election_id}::uuid, ${s.const_id}, 'IND', ${name}, FALSE)
      RETURNING id`;
    const [{ person_id }] = await tx.$queryRaw`SELECT person_id FROM candidates WHERE id = ${row.id}::uuid`;
    return { id: row.id as string, person_id: person_id as string | null };
  }

  const personExists = async (tx: any, id: string) =>
    ((await tx.$queryRaw`SELECT count(*)::int AS n FROM persons WHERE id = ${id}::uuid`) as { n: number }[])[0].n === 1;
  const personCount = async (tx: any) =>
    ((await tx.$queryRaw`SELECT count(*)::int AS n FROM persons`) as { n: number }[])[0].n;

  it('an insert without a person creates one from the ballot name and the seat state', async () => {
    await inRollbackTx('auto-create', async (tx, s) => {
      const before = await personCount(tx);
      const c = await insertCandidate(tx, s, 'TEST 018 AUTO PERSON');
      expect(c.person_id).not.toBeNull();
      const [p] = await tx.$queryRaw`SELECT name, state_id FROM persons WHERE id = ${c.person_id}::uuid`;
      expect(p).toEqual({ name: 'TEST 018 AUTO PERSON', state_id: s.state_id });
      expect(await personCount(tx)).toBe(before + 1);
    });
  });

  it('an insert with a person creates no person', async () => {
    await inRollbackTx('explicit person', async (tx, s) => {
      const first = await insertCandidate(tx, s, 'TEST 018 FIRST');
      const before = await personCount(tx);
      const second = await insertCandidate(tx, s, 'TEST 018 SECOND', first.person_id);
      expect(second.person_id).toBe(first.person_id);
      expect(await personCount(tx)).toBe(before);
    });
  });

  it('ON CONFLICT DO NOTHING on an existing id creates no person', async () => {
    await inRollbackTx('on conflict', async (tx, s) => {
      const c = await insertCandidate(tx, s, 'TEST 018 CONFLICT');
      const before = await personCount(tx);
      const inserted = await tx.$executeRaw`
        INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent)
        VALUES (${c.id}::uuid, NULL, ${s.election_id}::uuid, ${s.const_id}, 'IND', 'TEST 018 CONFLICT', FALSE)
        ON CONFLICT DO NOTHING`;
      expect(inserted).toBe(0);
      expect(await personCount(tx)).toBe(before);
    });
  });

  it('re-pointing a candidate deletes the person it leaves empty, and keeps one that still has candidates', async () => {
    await inRollbackTx('re-point', async (tx, s) => {
      const a = await insertCandidate(tx, s, 'TEST 018 A');
      const b = await insertCandidate(tx, s, 'TEST 018 B');
      const b2 = await insertCandidate(tx, s, 'TEST 018 B2', b.person_id);
      await tx.$executeRaw`UPDATE candidates SET person_id = ${b.person_id}::uuid WHERE id = ${a.id}::uuid`;
      expect(await personExists(tx, a.person_id!)).toBe(false);
      // Moving b away leaves b's person with a and b2, so it stays.
      const x = await insertCandidate(tx, s, 'TEST 018 X');
      await tx.$executeRaw`UPDATE candidates SET person_id = ${x.person_id}::uuid WHERE id = ${b.id}::uuid`;
      expect(await personExists(tx, b.person_id!)).toBe(true);
      expect(b2.person_id).toBe(b.person_id);
    });
  });

  it('a same-person update deletes nothing', async () => {
    await inRollbackTx('same person', async (tx, s) => {
      const c = await insertCandidate(tx, s, 'TEST 018 SAME');
      await tx.$executeRaw`UPDATE candidates SET person_id = person_id WHERE id = ${c.id}::uuid`;
      expect(await personExists(tx, c.person_id!)).toBe(true);
    });
  });

  it('deleting a candidate deletes the person it leaves empty', async () => {
    await inRollbackTx('delete', async (tx, s) => {
      const c = await insertCandidate(tx, s, 'TEST 018 DELETE');
      await tx.$executeRaw`DELETE FROM candidates WHERE id = ${c.id}::uuid`;
      expect(await personExists(tx, c.person_id!)).toBe(false);
    });
  });

  it('a person who still has candidates cannot be deleted (ON DELETE RESTRICT)', async () => {
    await inRollbackTx('restrict', async (tx, s) => {
      const c = await insertCandidate(tx, s, 'TEST 018 RESTRICT');
      await tx.$executeRaw`SAVEPOINT restrict_check`;
      await expect(tx.$executeRaw`DELETE FROM persons WHERE id = ${c.person_id}::uuid`).rejects.toThrow(/foreign key/i);
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT restrict_check`;
    });
  });

  it('a NULL person is rejected by the deferred check (checked immediately on request)', async () => {
    await inRollbackTx('deferred check', async (tx, s) => {
      const c = await insertCandidate(tx, s, 'TEST 018 NULL IMMEDIATE');
      await tx.$executeRaw`UPDATE candidates SET person_id = NULL WHERE id = ${c.id}::uuid`;
      await tx.$executeRaw`SAVEPOINT null_check`;
      await expect(tx.$executeRaw`SET CONSTRAINTS candidates_require_person IMMEDIATE`).rejects.toThrow(NULL_PERSON);
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT null_check`;
    });
  });

  it('a commit that leaves a candidate with a NULL person fails, and nothing is kept', async () => {
    if (unavailable('commit with NULL person')) return;
    const s = seat!;
    const name = `TEST 018 NULL COMMIT ${Date.now()}`;
    let committed = false;
    await expect(
      prisma!.$transaction(async (tx) => {
        const c = await insertCandidate(tx, s, name);
        await tx.$executeRaw`UPDATE candidates SET person_id = NULL WHERE id = ${c.id}::uuid`;
        committed = true;
      }),
    ).rejects.toThrow(NULL_PERSON);
    expect(committed).toBe(true);
    const [{ n }] = await prisma!.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM candidates WHERE name = ${name}`;
    expect(n).toBe(0);
  });

  /**
   * Runs SQL files through psql inside one transaction that is rolled back (their own BEGIN / COMMIT
   * are removed, so nothing is committed), with `fingerprint` printed before and after each file.
   * Returns the printed fingerprints, or null when skipped.
   */
  function runRolledBack(name: string, files: string[]): string[] | null {
    if (unavailable(name)) return null;
    if (spawnSync('psql', ['--version']).status !== 0) {
      if (REQUIRE_DB) throw new Error(`REQUIRE_DB_TESTS=1 but psql is not on the PATH (${name})`);
      console.warn(`SKIPPED (no psql on the PATH): ${name}`);
      return null;
    }
    const sql = files.map((f) => readFileSync(f, 'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm, ''));
    const fingerprint = `
      SELECT 'fp', (SELECT count(*) FROM persons),
             (SELECT count(*) FROM candidates WHERE person_id IS NULL),
             (SELECT count(*) FROM persons p WHERE NOT EXISTS (SELECT 1 FROM candidates c WHERE c.person_id = p.id)),
             (SELECT md5(string_agg(to_jsonb(p)::text, '|' ORDER BY p.id)) FROM persons p),
             (SELECT md5(string_agg(c.id::text || c.person_id::text || c.updated_at::text, '|' ORDER BY c.id)) FROM candidates c),
             (SELECT md5(string_agg(tgname || pg_get_triggerdef(oid), '|' ORDER BY tgname)) FROM pg_trigger WHERE tgrelid = 'candidates'::regclass),
             (SELECT md5(string_agg(table_name || column_name || data_type, '|' ORDER BY table_name, column_name))
                FROM information_schema.columns WHERE table_name IN ('candidates', 'persons', 'person_merges'));`;
    const script = ['BEGIN;', fingerprint, ...sql.flatMap((f) => [f, fingerprint]), 'ROLLBACK;'].join('\n');
    const url = process.env.DATABASE_URL!.replace(/([?&])schema=[^&]*&?/, '$1').replace(/[?&]$/, '');
    const run = spawnSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', url], {
      input: script,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PGOPTIONS: '-c standard_conforming_strings=on -c client_min_messages=warning' },
    });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    const prints = run.stdout.split('\n').filter((l) => l.startsWith('fp|'));
    expect(prints).toHaveLength(files.length + 1);
    return prints;
  }

  it('running 018 again (twice) is a no-op, and every candidate has a person', () => {
    const prints = runRolledBack('018 re-run', [MIGRATION, MIGRATION]);
    if (!prints) return;
    expect(prints[1]).toBe(prints[0]);
    expect(prints[2]).toBe(prints[0]);
    const [, , withoutPerson, orphans] = prints[0].split('|');
    expect(withoutPerson).toBe('0');
    expect(orphans).toBe('0');
  });

  it('re-running the candidate seeds and the Bihar person links creates no person and leaves no orphan', () => {
    const db = join(__dirname, '../../../../database');
    const prints = runRolledBack('seed re-run', [
      join(db, 'seed.sql'),
      join(db, 'seed_bihar_vs_2025.sql'),
      join(db, 'seed_wb_vs_2021.sql'),
      join(db, 'seed_bihar_persons.sql'),
    ]);
    if (!prints) return;
    // Person count, candidates without a person and orphans are unchanged after every file.
    const counts = prints.map((p) => p.split('|').slice(1, 4).join('|'));
    expect(new Set(counts).size).toBe(1);
    expect(counts[0].split('|').slice(1)).toEqual(['0', '0']);
  });
});
