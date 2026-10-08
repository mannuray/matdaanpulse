// backend/src/modules/ingest/lease.db.spec.ts
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { LeaseService } from './lease.service';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('LeaseService (DB)', () => {
  let prisma: PrismaClient | null = null;
  let eid: string | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try { await c.$queryRaw`SELECT 1 FROM ingest_shards LIMIT 1`; prisma = c; eid = (await c.elections.findFirst({ select: { id: true } }))?.id ?? null; }
    catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  async function run(name: string, body: (svc: LeaseService, tx: any, keys: [string, string]) => Promise<void>) {
    if (!prisma || !eid) { if (REQUIRE_DB) throw new Error(`no DB (${name})`); console.warn(`SKIPPED (no DB): ${name}`); return; }
    await prisma.$transaction(async (tx) => {
      const k1 = await tx.ingest_keys.create({ data: { name: `t1-${Date.now()}`, key_hash: 'a'.repeat(63) + '1' } });
      const k2 = await tx.ingest_keys.create({ data: { name: `t2-${Date.now()}`, key_hash: 'a'.repeat(63) + '2' } });
      await tx.ingest_shards.create({ data: { election_id: eid!, name: 'north', selector: { state_ids: [1] } } });
      await body(new LeaseService(tx as any), tx, [k1.id, k2.id]);
      throw new Rollback();
    }, { timeout: 20_000 }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
  }

  it('first claim wins; a second holder is refused until expiry, then takes over', async () => {
    await run('named shard', async (svc, _tx, [k1, k2]) => {
      const t0 = new Date('2027-02-27T09:00:00Z');
      expect(await svc.claim(eid!, 'north', k1, 'cloud', t0)).toMatchObject({ ok: true });
      expect(await svc.claim(eid!, 'north', k2, 'laptop', new Date(t0.getTime() + 30_000))).toMatchObject({ ok: false, holder: 'cloud' });
      expect(await svc.claim(eid!, 'north', k1, 'cloud', new Date(t0.getTime() + 60_000))).toMatchObject({ ok: true });
      expect(await svc.claim(eid!, 'north', k2, 'laptop', new Date(t0.getTime() + 151_000))).toMatchObject({ ok: true });
      expect(await svc.holds(eid!, 'north', k1, 'cloud', new Date(t0.getTime() + 151_000))).toBe(false);
      expect(await svc.holds(eid!, 'north', k2, 'laptop', new Date(t0.getTime() + 151_000))).toBe(true);
    });
  });

  it('the same key with another holder name is a different job; release frees the lease', async () => {
    await run('rest shard', async (svc, _tx, [k1]) => {
      const t0 = new Date('2027-02-27T09:00:00Z');
      expect(await svc.claim(eid!, 'rest', k1, 'a', t0)).toMatchObject({ ok: true });
      expect(await svc.claim(eid!, 'rest', k1, 'b', t0)).toMatchObject({ ok: false, holder: 'a' });
      await svc.release(eid!, 'rest', k1, 'a');
      expect(await svc.claim(eid!, 'rest', k1, 'b', t0)).toMatchObject({ ok: true });
    });
  });
  it('previous: set only when the lease changes hands (to another key or holder), never on a first claim or a renew', async () => {
    await run('takeover', async (svc, _tx, [k1, k2]) => {
      const t0 = new Date('2027-02-27T09:00:00Z');
      const at = (s: number) => new Date(t0.getTime() + s * 1000);
      expect(await svc.claim(eid!, 'north', k1, 'cloud', t0)).toMatchObject({ ok: true, previous: null });
      expect(await svc.claim(eid!, 'north', k1, 'cloud', at(30))).toMatchObject({ ok: true, previous: null }); // renew
      expect(await svc.claim(eid!, 'north', k1, 'cloud', at(200))).toMatchObject({ ok: true, previous: null }); // own lease, after expiry
      const take = await svc.claim(eid!, 'north', k2, 'laptop', at(400));
      expect(take).toMatchObject({ ok: true, previous: { holder: 'cloud', key_id: k1 } });
      expect((take as any).previous.expires_at).toEqual(at(290));
      await svc.release(eid!, 'north', k2, 'laptop');
      expect(await svc.claim(eid!, 'north', k1, 'cloud', at(401))).toMatchObject({ ok: true, previous: { holder: 'laptop', key_id: k2, expires_at: null } });
      // rest shard: same rule
      expect(await svc.claim(eid!, 'rest', k1, 'a', t0)).toMatchObject({ ok: true });
      expect(await svc.claim(eid!, 'rest', k1, 'b', at(100))).toMatchObject({ ok: true, previous: { holder: 'a', key_id: k1 } });
    });
  });

  it('a takeover audit row written by AuditLogService.log is found by the status window (timestamp column is UTC)', async () => {
    await run('takeover audit', async (_svc, tx) => {
      const { AuditLogService } = await import('../audit-log/audit-log.service');
      const { recentTakeovers } = await import('./ingest-status.service');
      await new AuditLogService(tx).log({ userId: null, action: 'INGEST_LEASE_TAKEOVER', entityType: 'election', entityId: eid!,
        oldValue: { shard: 'north', holder: 'cloud', expires_at: null }, newValue: { shard: 'north', holder: 'laptop' } });
      const found = await recentTakeovers(tx, eid!, new Date());
      expect(found.get('north')).toMatchObject({ from: 'cloud', to: 'laptop', after: 'release' });
      expect((await recentTakeovers(tx, eid!, new Date(Date.now() + 11 * 60_000))).size).toBe(0);
    });
  });
});
