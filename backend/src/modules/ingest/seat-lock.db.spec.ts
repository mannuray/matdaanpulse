/** lockSeats against the local DB: one statement takes one advisory lock per distinct seat, held until the transaction ends. */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { lockSeats } from './seat-lock';

config({ path: join(__dirname, '../../../.env') });
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('lockSeats (DB)', () => {
  let prisma: PrismaClient | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try { await c.$queryRaw`SELECT 1`; prisma = c; } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  it('holds one transaction-scoped advisory lock per distinct seat, keyed as before (hashtext of election:seat)', async () => {
    if (!prisma) { if (REQUIRE_DB) throw new Error('no DB'); console.warn('SKIPPED (no DB)'); return; }
    const e = '00000000-0000-0000-0000-00000000abcd';
    await prisma.$transaction(async (tx) => {
      await lockSeats(tx, e, ['S3', 'S1', 'S2', 'S1']);
      // A one-int8 advisory key is stored as classid = high 32 bits, objid = low 32 bits.
      const held = await tx.$queryRaw<{ objid: number }[]>`
        SELECT objid::bigint::int8 AS objid FROM pg_locks
        WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND granted ORDER BY objid`;
      const expected = await tx.$queryRaw<{ objid: number }[]>`
        SELECT (hashtext(${e}::text || ':' || id)::bigint & 4294967295) AS objid
        FROM unnest(ARRAY['S1','S2','S3']) AS id ORDER BY 1`;
      expect(held.map(r => Number(r.objid))).toEqual(expected.map(r => Number(r.objid)));
    });
  });
});
