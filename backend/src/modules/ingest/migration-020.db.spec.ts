// backend/src/modules/ingest/migration-020.db.spec.ts
/** Migration 020 triggers against the local DB; every change is rolled back. Skips (loudly) without a DB. */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('migration 020 live-version triggers (DB)', () => {
  let prisma: PrismaClient | null = null;
  let seat: { election_id: string; id: string } | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      await client.$queryRaw`SELECT 1 FROM seat_ingest_state LIMIT 1`;
      prisma = client;
      seat = await client.constituencies.findFirst({ select: { election_id: true, id: true } });
    } catch {
      await client.$disconnect();
    }
  });
  afterAll(async () => prisma?.$disconnect());

  async function inRollback(name: string, body: (tx: any, version: () => Promise<bigint>) => Promise<void>) {
    if (!prisma || !seat) {
      if (REQUIRE_DB) throw new Error(`REQUIRE_DB_TESTS=1 but no database with migration 020 (${name})`);
      console.warn(`SKIPPED (no database with migration 020): ${name}`);
      return;
    }
    const eid = seat.election_id;
    await prisma.$transaction(async (tx) => {
      const version = async () => BigInt((await tx.election_live_state.findUnique({ where: { election_id: eid } }))?.version ?? 0n);
      await body(tx, version);
      throw new Rollback();
    }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
  }

  it('seat state / round changes bump the version; a last_observed_at-only update does not', async () => {
    await inRollback('seat_ingest_state', async (tx, version) => {
      const v0 = await version();
      await tx.seat_ingest_state.create({ data: { election_id: seat!.election_id, const_id: seat!.id, state: 'counting', round_current: 1, round_total: 20 } });
      const v1 = await version();
      expect(v1).toBeGreaterThan(v0);
      await tx.seat_ingest_state.update({ where: { election_id_const_id: { election_id: seat!.election_id, const_id: seat!.id } }, data: { last_observed_at: new Date() } });
      expect(await version()).toBe(v1);
      await tx.seat_ingest_state.update({ where: { election_id_const_id: { election_id: seat!.election_id, const_id: seat!.id } }, data: { round_current: 2 } });
      expect(await version()).toBeGreaterThan(v1);
    });
  });

  it('an election status change bumps the version; a name change does not', async () => {
    await inRollback('elections.status', async (tx, version) => {
      const e = await tx.elections.findUnique({ where: { id: seat!.election_id }, select: { status: true, name: true } });
      const v0 = await version();
      await tx.elections.update({ where: { id: seat!.election_id }, data: { name: `${e.name} x` } });
      expect(await version()).toBe(v0);
      await tx.elections.update({ where: { id: seat!.election_id }, data: { status: e.status === 'Live' ? 'Finalized' : 'Live' } });
      expect(await version()).toBeGreaterThan(v0);
    });
  });
});
