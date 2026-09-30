/**
 * Integration check of migration 015's triggers against the local database. Every
 * change is rolled back.
 *
 * Without a reachable database (e.g. CI without Postgres) the tests print a loud
 * "SKIPPED" warning and pass; set REQUIRE_DB_TESTS=1 (CI with a database) to make a
 * missing database a failure instead, so the triggers cannot go untested unnoticed.
 */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: join(__dirname, '../../../.env') });

class Rollback extends Error {}

const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('election_live_state triggers (DB)', () => {
  let prisma: PrismaClient | null = null;
  let electionId: string | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      await client.$queryRaw`SELECT 1 FROM election_live_state LIMIT 1`;
      prisma = client;
      electionId = (await client.results.findFirst({ select: { election_id: true } }))?.election_id ?? null;
    } catch {
      await client.$disconnect();
    }
  });

  afterAll(async () => prisma?.$disconnect());

  /** Runs `body` in a transaction that is always rolled back; false when the DB is unavailable (and not required). */
  async function inRollbackTx(name: string, body: (tx: any, version: (tx: any) => Promise<bigint>, eid: string) => Promise<void>) {
    if (!prisma || !electionId) {
      if (REQUIRE_DB) throw new Error(`REQUIRE_DB_TESTS=1 but no database with migration 015 and seed data is reachable (${name})`);
      console.warn(`SKIPPED (no database with migration 015 and seed data): ${name}`);
      return;
    }
    const eid = electionId;
    const version = async (tx: any): Promise<bigint> =>
      BigInt((await tx.election_live_state.findUnique({ where: { election_id: eid } }))?.version ?? 0n);
    await prisma
      .$transaction(async (tx) => {
        await body(tx, version, eid);
        throw new Rollback();
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
  }

  it('a results UPDATE that changes snapshot columns bumps the version monotonically; no-op updates do not', async () => {
    await inRollbackTx('results UPDATE', async (tx, version, eid) => {
      const row = await tx.results.findFirst({ where: { election_id: eid }, select: { id: true } });
      const seen: bigint[] = [await version(tx)];
      await tx.$executeRaw`UPDATE results SET votes = votes + 1 WHERE id = ${row.id}::uuid`;
      seen.push(await version(tx));
      await tx.$executeRaw`UPDATE results SET votes = votes - 1 WHERE id = ${row.id}::uuid`;
      seen.push(await version(tx));
      await tx.$executeRaw`UPDATE results SET votes = votes WHERE id = '00000000-0000-0000-0000-000000000000'::uuid`;
      seen.push(await version(tx)); // matches no rows
      await tx.$executeRaw`UPDATE results SET votes = votes WHERE id = ${row.id}::uuid`;
      seen.push(await version(tx)); // same-value UPDATE
      await tx.$executeRaw`UPDATE parties SET symbol_url = symbol_url`;
      seen.push(await version(tx)); // columns not in snapshots
      expect(seen[1]).toBeGreaterThan(seen[0]);
      expect(seen[2]).toBeGreaterThan(seen[1]);
      expect(seen[3]).toBe(seen[2]);
      expect(seen[4]).toBe(seen[2]);
      expect(seen[5]).toBe(seen[2]);
    });
  });

  it('results DELETE and INSERT each bump the version', async () => {
    await inRollbackTx('results DELETE/INSERT', async (tx, version, eid) => {
      const row = await tx.results.findFirst({ where: { election_id: eid }, select: { id: true } });
      await tx.$executeRaw`CREATE TEMP TABLE _r_copy ON COMMIT DROP AS SELECT * FROM results WHERE id = ${row.id}::uuid`;
      const v0 = await version(tx);
      await tx.$executeRaw`DELETE FROM results WHERE id = ${row.id}::uuid`;
      const v1 = await version(tx);
      await tx.$executeRaw`INSERT INTO results SELECT * FROM _r_copy`;
      const v2 = await version(tx);
      expect(v1).toBeGreaterThan(v0);
      expect(v2).toBeGreaterThan(v1);
    });
  });

  it('candidate name, constituency type and party name/colour changes bump; other columns do not', async () => {
    await inRollbackTx('candidates/constituencies/parties', async (tx, version, eid) => {
      const cand = await tx.candidates.findFirst({ where: { election_id: eid, party_id: { not: null } }, select: { id: true, party_id: true } });
      const cons = await tx.constituencies.findFirst({ where: { election_id: eid }, select: { id: true } });

      let v = await version(tx);
      await tx.$executeRaw`UPDATE candidates SET is_incumbent = NOT is_incumbent WHERE id = ${cand.id}::uuid`;
      expect(await version(tx)).toBe(v); // not a snapshot column
      await tx.$executeRaw`UPDATE candidates SET name = name || ' x' WHERE id = ${cand.id}::uuid`;
      expect(await version(tx)).toBeGreaterThan(v);

      v = await version(tx);
      await tx.$executeRaw`UPDATE constituencies SET voter_turnout = voter_turnout WHERE id = ${cons.id}`;
      expect(await version(tx)).toBe(v);
      await tx.$executeRaw`UPDATE constituencies SET type = CASE WHEN type = 'GEN' THEN 'SC'::constituency_type ELSE 'GEN'::constituency_type END WHERE id = ${cons.id}`;
      expect(await version(tx)).toBeGreaterThan(v);

      v = await version(tx);
      await tx.$executeRaw`UPDATE parties SET name = name || ' x' WHERE id = ${cand.party_id}`;
      const v2 = await version(tx);
      expect(v2).toBeGreaterThan(v);
      await tx.$executeRaw`UPDATE parties SET color = COALESCE(color, '') || '1' WHERE id = ${cand.party_id}`;
      expect(await version(tx)).toBeGreaterThan(v2);
    });
  });
});
