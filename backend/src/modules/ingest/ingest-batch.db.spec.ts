/**
 * A whole large state in ONE ingest request (the worker posts up to MAX_SEATS_PER_REQUEST seats per request, so a
 * state yields one snapshot version per cycle): every seat of the largest VS election (UP, 403 seats) against the
 * local DB, timed, then rolled back. Guards the 60 s transaction timeout, the worker's 30 s request timeout and the
 * 5 MB ingest body limit.
 */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { IngestService } from './ingest.service';
import { MAX_SEATS_PER_REQUEST } from './dto/ingest.dto';
import { INGEST_BODY_LIMIT } from '../../app.setup';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';
/** Well inside the worker's per-request timeout (scraper IngestClient, 30 s) on a laptop DB. */
const MAX_MS = 15_000;

describe('ingest: a whole large state in one request (DB)', () => {
  let prisma: PrismaClient | null = null;
  let election: { id: string; seats: { id: string; cands: { id: string; party_id: string | null }[] }[] } | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try {
      await c.$queryRaw`SELECT 1 FROM seat_ingest_state LIMIT 1`;
      prisma = c;
      const [big] = await c.$queryRaw<{ id: string }[]>`
        SELECT e.id::text AS id FROM elections e JOIN constituencies k ON k.election_id = e.id
        WHERE e.type = 'VS' GROUP BY e.id ORDER BY COUNT(*) DESC, e.year DESC LIMIT 1`;
      if (big) {
        const cands = await c.candidates.findMany({ where: { election_id: big.id }, select: { id: true, const_id: true, party_id: true } });
        const by = new Map<string, { id: string; party_id: string | null }[]>();
        for (const x of cands) (by.get(x.const_id) ?? by.set(x.const_id, []).get(x.const_id)!).push({ id: x.id, party_id: x.party_id });
        election = { id: big.id, seats: [...by].map(([id, cs]) => ({ id, cands: cs })) };
      }
    } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  it(`applies every seat of the largest state in one request within ${MAX_MS / 1000} s, and the body fits the limit`, async () => {
    if (!prisma || !election) { if (REQUIRE_DB) throw new Error('no DB'); console.warn('SKIPPED (no DB)'); return; }
    const e = election;
    expect(e.seats.length).toBeGreaterThanOrEqual(400);
    expect(e.seats.length).toBeLessThanOrEqual(MAX_SEATS_PER_REQUEST);
    const body = {
      shard: 'rest', source: 'test', holder: 'h', observed_at: '2027-02-27T04:11:00Z',
      seats: e.seats.map(s => ({ const_id: s.id, state: 'counting', round: { current: 3, total: 20 },
        votes: Object.fromEntries(s.cands.map((c, i) => [c.id, c.party_id === 'NOTA' ? 1 : 1000 + (s.cands.length - i) * 10])) })),
    };
    // Body size: this state, and a full 500-seat request at this state's largest seat.
    const bytes = Buffer.byteLength(JSON.stringify(body));
    const perCand = bytes / e.seats.reduce((n, s) => n + s.cands.length, 0);
    const worst = 500 * Math.max(...e.seats.map(s => s.cands.length)) * perCand;
    const limit = parseInt(INGEST_BODY_LIMIT, 10) * 1024 * 1024;
    expect(worst).toBeLessThan(limit);

    let took = 0;
    await prisma.$transaction(async (tx) => {
      await tx.elections.update({ where: { id: e.id }, data: { status: 'Live' } });
      await tx.election_ingest.upsert({ where: { election_id: e.id }, create: { election_id: e.id, active_source: 'test' }, update: { active_source: 'test' } });
      await tx.seat_ingest_state.deleteMany({ where: { election_id: e.id } });
      await tx.seat_holds.deleteMany({ where: { election_id: e.id } });
      const db: any = new Proxy(tx, { get: (t: any, p) => (p === '$transaction' ? (fn: any) => fn(t) : t[p]) });
      const shards: any = { get: async () => ({ name: 'rest', source_override: null, seat_ids: e.seats.map(s => s.id), lease_holder: null, lease_expires_at: null }) };
      const leases: any = { holds: async () => true, current: async () => null };
      const key = await tx.ingest_keys.create({ data: { name: `batch-${Date.now()}`, key_hash: 'd'.repeat(64) }, select: { id: true } });
      const svc = new IngestService(db, shards, leases, { afterCommit: jest.fn(async () => undefined) } as any);
      const t0 = Date.now();
      const out = await svc.ingestSeats(e.id, key, body as any, new Date('2027-02-27T04:12:00Z'));
      took = Date.now() - t0;
      expect(out.counts.applied).toBe(e.seats.length);
      throw new Rollback();
    }, { timeout: 120_000, maxWait: 10_000 }).catch((err) => { if (!(err instanceof Rollback)) throw err; });
    console.log(`ingest of ${e.seats.length} seats in one request: ${took} ms; body ${(bytes / 1024).toFixed(0)} KB (500-seat worst case ≈ ${(worst / 1024 / 1024).toFixed(2)} MB of ${INGEST_BODY_LIMIT})`);
    expect(took).toBeLessThan(MAX_MS);
  }, 180_000);
});
