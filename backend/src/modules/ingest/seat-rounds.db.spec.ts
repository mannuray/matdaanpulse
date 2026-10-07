/** appendSeatRounds against the local DB; every write is rolled back. */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { appendSeatRounds } from './seat-rounds';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('seat timeline (DB)', () => {
  let prisma: PrismaClient | null = null;
  let seat: { election_id: string; const_id: string; cands: { id: string; party_id: string | null }[] } | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try {
      await c.$queryRaw`SELECT 1 FROM seat_rounds LIMIT 1`;
      const r = await c.results.findFirst({ where: { candidates: { party_id: { not: 'NOTA' } } }, select: { election_id: true, const_id: true } });
      if (r) seat = { ...r, cands: await c.candidates.findMany({ where: { election_id: r.election_id, const_id: r.const_id, NOT: { party_id: 'NOTA' } }, select: { id: true, party_id: true } }) };
      prisma = c;
    } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  async function run(name: string, body: (tx: any) => Promise<void>) {
    if (!prisma || !seat || seat.cands.length < 2) { if (REQUIRE_DB) throw new Error(`no DB (${name})`); console.warn(`SKIPPED (no DB): ${name}`); return; }
    await prisma.$transaction(async tx => { await body(tx); throw new Rollback(); }, { timeout: 30_000 }).catch(e => { if (!(e instanceof Rollback)) throw e; });
  }
  const setVotes = (tx: any, a: number, b: number, status: [string, string] = ['LEADING', 'TRAILING']) => tx.$executeRaw`
    UPDATE results SET votes = CASE candidate_id WHEN ${seat!.cands[0].id}::uuid THEN ${a} WHEN ${seat!.cands[1].id}::uuid THEN ${b} ELSE 0 END,
      status = (CASE candidate_id WHEN ${seat!.cands[0].id}::uuid THEN ${status[0]} WHEN ${seat!.cands[1].id}::uuid THEN ${status[1]} ELSE 'TRAILING' END)::result_status
    WHERE election_id = ${seat!.election_id}::uuid AND const_id = ${seat!.const_id}`;
  const rows = (tx: any) => tx.seat_rounds.findMany({ where: { election_id: seat!.election_id, const_id: seat!.const_id }, orderBy: { seq: 'asc' } });

  it('appends only on change; seq increases; a lead switch and a declaration are rows', () => run('append', async tx => {
    await tx.$executeRaw`DELETE FROM seat_rounds WHERE election_id = ${seat!.election_id}::uuid AND const_id = ${seat!.const_id}`;
    const at = new Date('2027-02-27T04:00:00Z');
    await setVotes(tx, 100, 50);
    expect(await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'ingest', at)).toBe(1);
    expect(await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'ingest', at)).toBe(0); // unchanged
    await setVotes(tx, 100, 150, ['TRAILING', 'LEADING']);
    await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'ingest', at);
    await setVotes(tx, 300, 150, ['WON', 'LOST']);
    await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'correction', at);
    const r = await rows(tx);
    expect(r.map((x: any) => [x.seq, x.leader_candidate_id, x.margin, x.declared, x.source])).toEqual([
      [1, seat!.cands[0].id, 50, false, 'ingest'], [2, seat!.cands[1].id, 50, false, 'ingest'], [3, seat!.cands[0].id, 150, true, 'correction'],
    ]);
    expect(r[2].votes_counted).toBe(450);
  }));

  it('two appends of the same seat in one transaction never duplicate a seq', () => run('seq', async tx => {
    await tx.$executeRaw`DELETE FROM seat_rounds WHERE election_id = ${seat!.election_id}::uuid AND const_id = ${seat!.const_id}`;
    await setVotes(tx, 10, 5); await appendSeatRounds(tx, seat!.election_id, [seat!.const_id, seat!.const_id], 'ingest', new Date());
    await setVotes(tx, 20, 5); await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'ingest', new Date());
    expect((await rows(tx)).map((x: any) => x.seq)).toEqual([1, 2]);
  }));
});
