/** IngestService.write + the live-version triggers against the local DB; rolled back. */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { IngestService } from './ingest.service';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('ingest write (DB)', () => {
  let prisma: PrismaClient | null = null;
  let seat: { election_id: string; const_id: string; cands: { id: string; party_id: string | null }[] } | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try {
      await c.$queryRaw`SELECT 1 FROM seat_ingest_state LIMIT 1`;
      prisma = c;
      const r = await c.results.findFirst({ select: { election_id: true, const_id: true } });
      if (r) seat = { ...r, cands: await c.candidates.findMany({ where: { election_id: r.election_id, const_id: r.const_id }, select: { id: true, party_id: true } }) };
    } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  async function run(name: string, body: (svc: IngestService, tx: any, notifier: any, key: { id: string }) => Promise<void>) {
    if (!prisma || !seat) { if (REQUIRE_DB) throw new Error(`no DB (${name})`); console.warn(`SKIPPED (no DB): ${name}`); return; }
    await prisma.$transaction(async (tx) => {
      await tx.elections.update({ where: { id: seat!.election_id }, data: { status: 'Live' } });
      await tx.election_ingest.upsert({ where: { election_id: seat!.election_id }, create: { election_id: seat!.election_id, active_source: 'test' }, update: { active_source: 'test' } });
      // Run the service against this transaction: $transaction(fn) runs fn on the same tx.
      const db: any = new Proxy(tx, { get: (t: any, p) => (p === '$transaction' ? (fn: any) => fn(t) : t[p]) });
      const shards: any = { get: async () => ({ name: 'rest', source_override: null, seat_ids: [seat!.const_id], lease_holder: null, lease_expires_at: null }) };
      const leases: any = { holds: async () => true, current: async () => null };
      const notifier = { afterCommit: jest.fn(async () => undefined) };
      // ingest_log.key_id is a FK to a real key (rolled back with the rest).
      const key = await tx.ingest_keys.create({ data: { name: `t6-${Date.now()}`, key_hash: 'f'.repeat(64) }, select: { id: true } });
      await body(new IngestService(db, shards, leases, notifier as any), tx, notifier, key);
      throw new Rollback();
    }, { timeout: 30_000 }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
  }
  const version = async (tx: any) => BigInt((await tx.election_live_state.findUnique({ where: { election_id: seat!.election_id } }))?.version ?? 0n);
  const votes = (base: number) => Object.fromEntries(seat!.cands.map((c, i) => [c.id, c.party_id === 'NOTA' ? 1 : base + (seat!.cands.length - i) * 10]));
  const req = (v: Record<string, number>, round: number, at: string) => ({ shard: 'rest', source: 'test', holder: 'h', observed_at: at, seats: [{ const_id: seat!.const_id, state: 'counting', round: { current: round, total: 20 }, votes: v }] }) as any;

  it('applies a seat, then an identical repeat is unchanged and bumps no version', async () => {
    await run('apply then repeat', async (svc, tx, _n, key) => {
      const now = new Date('2027-02-27T04:12:00Z');
      const a = await svc.ingestSeats(seat!.election_id, key, req(votes(1000), 3, '2027-02-27T04:11:00Z'), now);
      expect(a.counts.applied).toBe(1);
      const stored = await tx.results.findMany({ where: { election_id: seat!.election_id, const_id: seat!.const_id }, select: { status: true } });
      expect(stored.filter((r: any) => r.status === 'LEADING')).toHaveLength(1);
      const v1 = await version(tx);
      const b = await svc.ingestSeats(seat!.election_id, key, req(votes(1000), 3, '2027-02-27T04:11:30Z'), now);
      expect(b.counts.unchanged).toBe(1);
      expect(await version(tx)).toBe(v1);
    });
  });

  it('an older round is stale and changes nothing', async () => {
    await run('stale', async (svc, tx, _n, key) => {
      const now = new Date('2027-02-27T04:12:00Z');
      await svc.ingestSeats(seat!.election_id, key, req(votes(1000), 5, '2027-02-27T04:11:00Z'), now);
      const out = await svc.ingestSeats(seat!.election_id, key, req(votes(10), 4, '2027-02-27T04:11:30Z'), now);
      expect(out.counts.stale).toBe(1);
      const st = await tx.seat_ingest_state.findUnique({ where: { election_id_const_id: { election_id: seat!.election_id, const_id: seat!.const_id } } });
      expect(st.round_current).toBe(5);
    });
  });
});

describe('ingest write (DB) — locks, rejections, results rows', () => {
  let prisma: PrismaClient | null = null;
  let seat: { election_id: string; const_id: string; cands: { id: string; party_id: string | null }[] } | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try {
      await c.$queryRaw`SELECT last_rejected_reason FROM seat_ingest_state LIMIT 1`;
      prisma = c;
      const r = await c.results.findFirst({ select: { election_id: true, const_id: true } });
      if (r) seat = { ...r, cands: await c.candidates.findMany({ where: { election_id: r.election_id, const_id: r.const_id }, select: { id: true, party_id: true } }) };
    } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  async function run(name: string, beforeTx: ((tx: any) => Promise<void>) | null, body: (svc: IngestService, tx: any, key: { id: string }) => Promise<void>) {
    if (!prisma || !seat) { if (REQUIRE_DB) throw new Error(`no DB with migration 021 (${name})`); console.warn(`SKIPPED (no DB): ${name}`); return; }
    await prisma.$transaction(async (tx) => {
      await tx.elections.update({ where: { id: seat!.election_id }, data: { status: 'Live' } });
      await tx.election_ingest.upsert({ where: { election_id: seat!.election_id }, create: { election_id: seat!.election_id, active_source: 'test' }, update: { active_source: 'test' } });
      await tx.seat_ingest_state.deleteMany({ where: { election_id: seat!.election_id, const_id: seat!.const_id } });
      await tx.seat_holds.deleteMany({ where: { election_id: seat!.election_id, const_id: seat!.const_id } });
      let hook = beforeTx;
      const db: any = new Proxy(tx, { get: (t: any, p) => (p === '$transaction' ? async (fn: any) => { const h = hook; hook = null; if (h) await h(t); return fn(t); } : t[p]) });
      const shards: any = { get: async () => ({ name: 'rest', source_override: null, seat_ids: [seat!.const_id], lease_holder: null, lease_expires_at: null }) };
      const leases: any = { holds: async () => true, current: async () => null };
      const key = await tx.ingest_keys.create({ data: { name: `t7-${Date.now()}`, key_hash: 'e'.repeat(64) }, select: { id: true } });
      await body(new IngestService(db, shards, leases, { afterCommit: jest.fn(async () => undefined) } as any), tx, key);
      throw new Rollback();
    }, { timeout: 30_000 }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
  }
  const votes = (base: number) => Object.fromEntries(seat!.cands.map((c, i) => [c.id, c.party_id === 'NOTA' ? 1 : base + (seat!.cands.length - i) * 10]));
  const req = (v: Record<string, number>, round: number) => ({ shard: 'rest', source: 'test', holder: 'h', observed_at: '2027-02-27T04:11:00Z', seats: [{ const_id: seat!.const_id, state: 'counting', round: { current: round, total: 20 }, votes: v }] }) as any;
  const now = new Date('2027-02-27T04:12:00Z');
  const rows = (tx: any) => tx.results.findMany({ where: { election_id: seat!.election_id, const_id: seat!.const_id }, select: { candidate_id: true, votes: true } });

  it('a hold created after the request arrived but before its transaction keeps the seat (held, not overwritten)', async () => {
    await run('hold race', async (tx) => {
      await tx.seat_holds.create({ data: { election_id: seat!.election_id, const_id: seat!.const_id, round_at_hold: 3, expires_at: new Date(now.getTime() + 600_000) } });
    }, async (svc, tx, key) => {
      const before = await rows(tx);
      const out = await svc.ingestSeats(seat!.election_id, key, req(votes(777_000), 3), now);
      expect(out.counts).toMatchObject({ held: 1, applied: 0 });
      expect(await rows(tx)).toEqual(before);
    });
  });

  it('a rejected seat stays rejected on seat_ingest_state (no state, no version bump) until it next goes through', async () => {
    await run('rejection persists', null, async (svc, tx, key) => {
      const v = async () => BigInt((await tx.election_live_state.findUnique({ where: { election_id: seat!.election_id } }))?.version ?? 0n);
      const bad = { ...votes(1000), 'not-a-candidate': 5 };
      const v0 = await v();
      expect((await svc.ingestSeats(seat!.election_id, key, req(bad, 3), now)).counts.rejected).toBe(1);
      const st = await tx.seat_ingest_state.findUnique({ where: { election_id_const_id: { election_id: seat!.election_id, const_id: seat!.const_id } } });
      expect(st).toMatchObject({ state: null, last_rejected_reason: 'roster_mismatch' });
      expect(await v()).toBe(v0);
      expect((await svc.ingestSeats(seat!.election_id, key, req(votes(1000), 3), now)).counts.applied).toBe(1);
      const after = await tx.seat_ingest_state.findUnique({ where: { election_id_const_id: { election_id: seat!.election_id, const_id: seat!.const_id } } });
      expect(after).toMatchObject({ state: 'counting', round_current: 3, last_rejected_reason: null, last_rejected_at: null });
    });
  });

  it('a roster candidate without a results row rejects the seat (missing_result_rows) and writes nothing', async () => {
    await run('missing results row', null, async (svc, tx, key) => {
      const gone = seat!.cands[0].id;
      await tx.results.deleteMany({ where: { election_id: seat!.election_id, candidate_id: gone } });
      const before = await rows(tx);
      const out = await svc.ingestSeats(seat!.election_id, key, req(votes(5000), 4), now);
      expect(out.seats).toEqual([expect.objectContaining({ outcome: 'rejected', reason: 'missing_result_rows', detail: { missing: [gone] } })]);
      expect(await rows(tx)).toEqual(before);
    });
  });
});
