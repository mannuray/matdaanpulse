/**
 * Integration check of migration 018 (every candidate has a person) against the local database:
 * the AFTER INSERT trigger that creates a person, the deferred check that no candidate commits
 * without one, the trigger that deletes a person left without candidates, and a re-run of the
 * migration being a no-op, the run-once metadata copy and archive, and the run-once Bihar person seeds.
 * Every change is rolled back, except in the commit test, which must fail.
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
    const stdout = psqlRolledBack([fingerprint, ...sql.flatMap((f) => [f, fingerprint])].join('\n'));
    const prints = stdout.split('\n').filter((l) => l.startsWith('fp|'));
    expect(prints).toHaveLength(files.length + 1);
    return prints;
  }

  /** Runs `body` through psql between BEGIN and ROLLBACK (so nothing is committed) and returns its output. */
  function psqlRolledBack(body: string): string {
    const script = ['BEGIN;', body, 'ROLLBACK;'].join('\n');
    const url = process.env.DATABASE_URL!.replace(/([?&])schema=[^&]*&?/, '$1').replace(/[?&]$/, '');
    const run = spawnSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', url], {
      input: script,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PGOPTIONS: '-c standard_conforming_strings=on -c client_min_messages=warning' },
    });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    return run.stdout;
  }

  /** The 018 file without its own BEGIN / COMMIT, for psqlRolledBack. */
  const migrationBody = () => readFileSync(MIGRATION, 'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');

  it('running 018 again (twice) is a no-op, and every candidate has a person', () => {
    const prints = runRolledBack('018 re-run', [MIGRATION, MIGRATION]);
    if (!prints) return;
    expect(prints[1]).toBe(prints[0]);
    expect(prints[2]).toBe(prints[0]);
    // Re-running 018 creates no orphan (prints are identical). Persons without a candidacy can exist on purpose:
    // seed_bihar_leaders adds Bihar leaders with no Bihar VS seat (Legislative Council members) so manifests link them.
    const [, , withoutPerson] = prints[0].split('|');
    expect(withoutPerson).toBe('0');
  });

  it('copies metadata once (a value cleared later is not refilled), archives every non-empty object, keeps the columns', () => {
    if (!runRolledBack('metadata archive', [])) return;
    const [p1, p2] = ['00000000-0000-4000-8000-0000000018a1', '00000000-0000-4000-8000-0000000018a2'];
    // As on production before 018: metadata in the (kept) columns, and the copy not yet run.
    const out = psqlRolledBack(`
      DELETE FROM seed_runs WHERE name = 'migration_018_metadata_copy';
      INSERT INTO persons (id, name, metadata) VALUES
        ('${p1}', 'TEST 018 ARCHIVED', '{"bio":"b","affidavit_history":{"e1":{"age":40}}}'),
        ('${p2}', 'TEST 018 MOVED ONLY', '{"caste":"c"}');
      INSERT INTO candidates (person_id, election_id, const_id, party_id, name, is_incumbent, metadata)
        VALUES ('${p1}', '${seat!.election_id}', '${seat!.const_id}', 'IND', 'TEST 018 ARCHIVED', FALSE,
                '{"age":"40","unknown_key":1}'),
               ('${p2}', '${seat!.election_id}', '${seat!.const_id}', 'IND', 'TEST 018 MOVED ONLY', FALSE,
                '{"assets":"1,23,45,678","liabilities":"1234567890123456"}');
      ${migrationBody()}
      SELECT 'pa', person_id, metadata::text FROM person_metadata_archive WHERE person_id IN ('${p1}', '${p2}') ORDER BY person_id;
      SELECT 'ca', c.person_id, a.metadata::text FROM candidate_metadata_archive a JOIN candidates c ON c.id = a.candidate_id
        WHERE c.person_id IN ('${p1}', '${p2}') ORDER BY c.person_id;
      SELECT 'cols', p.id, p.bio, p.caste, c.age, c.assets, c.liabilities FROM persons p JOIN candidates c ON c.person_id = p.id
        WHERE p.id IN ('${p1}', '${p2}') ORDER BY p.id;
      UPDATE persons SET bio = NULL WHERE id = '${p1}';
      UPDATE candidates SET age = NULL WHERE person_id = '${p1}';
      ${migrationBody()}
      SELECT 'rerun', p.bio IS NULL, c.age IS NULL FROM persons p JOIN candidates c ON c.person_id = p.id WHERE p.id = '${p1}';
      SELECT 'archived_once', count(*) FROM person_metadata_archive WHERE person_id IN ('${p1}', '${p2}');
      SELECT 'kept', count(*) FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name IN ('persons', 'candidates') AND column_name = 'metadata';
      SELECT 'marker', count(*) FROM seed_runs WHERE name = 'migration_018_metadata_copy';`);
    const lines = out.split('\n');
    expect(lines.filter((l) => l.startsWith('pa|'))).toEqual([
      `pa|${p1}|{"bio": "b", "affidavit_history": {"e1": {"age": 40}}}`,
      `pa|${p2}|{"caste": "c"}`,
    ]);
    expect(lines.filter((l) => l.startsWith('ca|'))).toEqual([
      `ca|${p1}|{"age": "40", "unknown_key": 1}`,
      // Not copied (not plain digits / more than 15 digits): the archive is the only copy.
      `ca|${p2}|{"assets": "1,23,45,678", "liabilities": "1234567890123456"}`,
    ]);
    expect(lines.filter((l) => l.startsWith('cols|'))).toEqual([`cols|${p1}|b||40||`, `cols|${p2}||c|||`]);
    expect(lines).toContain('rerun|t|t');
    expect(lines).toContain('archived_once|2');
    expect(lines).toContain('kept|2');
    expect(lines).toContain('marker|1');
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
    expect(new Set(counts).size).toBe(1); // no file changes the person, without-person or orphan counts
    expect(counts[0].split('|')[1]).toBe('0'); // every candidate has a person (seatless leaders are intended orphans)
  });

  it('the Bihar person seeds are run-once: a split, a merge and a state edit survive a re-run, with or without the markers', () => {
    if (!runRolledBack('seed run-once', [])) return;
    const db = join(__dirname, '../../../../database');
    const seeds = ['seed_bihar_persons.sql', 'seed_bihar_person_regions.sql']
      .map((f) => readFileSync(join(db, f), 'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm, ''));
    const fingerprint = `
      SELECT 'fp', (SELECT md5(string_agg(to_jsonb(p)::text, '|' ORDER BY p.id)) FROM persons p),
             (SELECT md5(string_agg(c.id::text || c.person_id::text, '|' ORDER BY c.id)) FROM candidates c),
             (SELECT md5(coalesce(string_agg(to_jsonb(m)::text, '|' ORDER BY m.id), '')) FROM person_merges m);`;
    const out = psqlRolledBack(`
      -- Split: one of ALOK RANJAN's four contests moves to a new person.
      WITH np AS (INSERT INTO persons (name, state_id) VALUES ('ALOK RANJAN', 5) RETURNING id)
      UPDATE candidates SET person_id = (SELECT id FROM np) WHERE id = 'b5da2bcd-3cf5-48d0-914a-efbffc2d0e2d';
      -- Merge: AMRENDRA KUMAR PANDEY into ANANT KUMAR SINGH, logged as PersonsService.merge does.
      INSERT INTO person_merges (keeper_id, keeper_ref, duplicate, candidate_ids)
      SELECT 'e63ec8a1-64f4-4f5e-a69b-72405c2511c9', 'e63ec8a1-64f4-4f5e-a69b-72405c2511c9', to_jsonb(p),
             ARRAY(SELECT id FROM candidates WHERE person_id = p.id)
      FROM persons p WHERE p.id = 'c10d3adf-7779-4904-988d-e47ba8907f11';
      UPDATE candidates SET person_id = 'e63ec8a1-64f4-4f5e-a69b-72405c2511c9'
      WHERE person_id = 'c10d3adf-7779-4904-988d-e47ba8907f11';
      -- State edit.
      UPDATE persons SET state_id = 10, region_id = NULL WHERE id = '99cba246-f19b-48dc-a4c2-f381e1d52e4f';
      SELECT 'merged_away', count(*) FROM persons WHERE id = 'c10d3adf-7779-4904-988d-e47ba8907f11';
      ${fingerprint}
      ${seeds.join('\n')}
      ${fingerprint}
      -- As on production, where the seeds ran before seed_runs existed.
      DELETE FROM seed_runs WHERE name IN ('seed_bihar_persons', 'seed_bihar_person_regions');
      ${seeds.join('\n')}
      ${fingerprint}
      SELECT 'markers', count(*) FROM seed_runs WHERE name IN ('seed_bihar_persons', 'seed_bihar_person_regions');`);
    const lines = out.split('\n');
    expect(lines).toContain('merged_away|0');
    const prints = lines.filter((l) => l.startsWith('fp|'));
    expect(prints).toHaveLength(3);
    expect(new Set(prints).size).toBe(1);
    expect(lines).toContain('markers|2');
  });
});
