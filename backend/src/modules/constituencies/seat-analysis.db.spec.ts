/** SeatAnalysisService against the local DB (Bihar 2025); every write is rolled back. */
import { config } from 'dotenv';
import { join } from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import { SeatAnalysisService } from './seat-analysis.service';
import { SeatAnalysisLoader } from './seat-analysis.loader';
import { isDeepStrictEqual } from 'util';
import { analyse, analyseLive, baselineOf } from '../../common/seat-analysis';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('seat analysis compute (DB)', () => {
  let prisma: PrismaClient | null = null;
  let br25: string | null = null, br20: string | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try {
      await c.$queryRaw`SELECT 1 FROM election_analysis LIMIT 1`;
      const st = await c.states.findFirst({ where: { code: 'BR' }, select: { id: true } });
      br25 = (await c.elections.findFirst({ where: { state_id: st?.id, type: 'VS', year: 2025 }, select: { id: true } }))?.id ?? null;
      br20 = (await c.elections.findFirst({ where: { state_id: st?.id, type: 'VS', year: 2020 }, select: { id: true } }))?.id ?? null;
      prisma = c;
    } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  async function run(name: string, body: (svc: SeatAnalysisService, tx: any) => Promise<void>) {
    if (!prisma || !br25 || !br20) { if (REQUIRE_DB) throw new Error(`no DB (${name})`); console.warn(`SKIPPED (no DB): ${name}`); return; }
    await prisma.$transaction(async tx => {
      const db: any = new Proxy(tx, { get: (t: any, p) => (p === '$transaction' ? (fn: any) => fn(t) : t[p]) });
      const cache: any = { del: jest.fn(async () => undefined), getOrSet: async (_k: string, _t: number, f: () => unknown) => f() };
      await body(new SeatAnalysisService(db, new SeatAnalysisLoader(db), cache), tx);
      throw new Rollback();
    }, { timeout: 600_000 }).catch(e => { if (!(e instanceof Rollback)) throw e; });
  }

  it('Bihar 2025 compares with 2020 (not 2010), stores data + summary, purges caches', () => run('bihar', async (svc, tx) => {
    const r = await svc.compute(br25!);
    expect(r.computed).toBe(243);
    const row = await tx.constituency_analysis.findFirst({ where: { election_id: br25!, data: { not: Prisma.DbNull } } });
    const data = row.data as any;
    expect(data.schema_version).toBe(1);
    expect(data.history.map((h: any) => h.year)).toEqual([...data.history.map((h: any) => h.year)].sort());
    const prevWinner = await tx.results.findFirst({ where: { election_id: br20!, status: 'WON', constituencies: { const_no: data.const_no } }, select: { candidates: { select: { name: true } } } });
    expect(data.incumbent?.name).toBe(prevWinner?.candidates.name);
    const summary = await tx.election_analysis.findUnique({ where: { election_id: br25! } });
    expect((summary!.data as any).prev_election_id).toBe(br20);
  }));

  it('a recompute keeps admin notes and gives the same rows', () => run('notes', async (svc, tx) => {
    await svc.compute(br25!);
    const row = await tx.constituency_analysis.findFirst({ where: { election_id: br25! } });
    await tx.constituency_analysis.update({ where: { id: row.id }, data: { notes: 'admin note' } });
    const before = (await tx.constituency_analysis.findUnique({ where: { id: row.id } })).data;
    await svc.compute(br25!);
    const after = await tx.constituency_analysis.findUnique({ where: { id: row.id } });
    expect(after.notes).toBe('admin note');
    expect(after.data).toEqual(before);
  }));

  it('computeBaseline stores the baseline and its time; a second run keeps the final data', () => run('baseline', async (svc, tx) => {
    await svc.compute(br25!);
    const before = (await tx.election_analysis.findUnique({ where: { election_id: br25! } })).data;
    expect(await svc.computeBaseline(br25!)).toEqual({ seats: 243 });
    const row = await tx.election_analysis.findUnique({ where: { election_id: br25! } });
    expect((row.baseline as any).seats).toHaveLength(243);
    expect(row.baseline_computed_at).toBeInstanceOf(Date);
    expect(row.data).toEqual(before);
    expect((await svc.computeFor(br25!)).kind).toBe('final');
  }));

  it('live on final results equals the final analysis for every VS election', () => run('live=final', async (_svc, tx) => {
    const loader = new SeatAnalysisLoader(tx);
    let seats = 0; const bad: string[] = [];
    for (const e of await tx.elections.findMany({ where: { type: 'VS' }, select: { id: true } })) {
      const inp = await loader.load(e.id);
      const fin = analyse(inp);
      const l = analyseLive(baselineOf(inp), inp.current.seats.map(s => ({ const_id: s.const_id, candidates: s.candidates, round: null, trail: null })));
      const finBy = new Map(fin.seats.map(s => [s.const_id, s]));
      for (const s of l.seats) {
        seats++; const f = finBy.get(s.const_id)!;
        if (!isDeepStrictEqual([s.leader?.name ?? null, s.margin, s.outcome, s.swing], [f.winner?.name ?? null, f.margin, f.outcome, f.swing])) bad.push(s.const_id);
      }
      if (!isDeepStrictEqual(l.tally.flow, fin.election.flow)) bad.push(`${e.id} flow`);
      const mv = (rows: { from: string; to: string; seats: number }[]) => rows.map(m => `${m.from}>${m.to}:${m.seats}`).sort();
      if (!isDeepStrictEqual(mv(l.tally.alliance_moves), mv(fin.election.alliance?.moves ?? []))) bad.push(`${e.id} alliance`);
      const hg = (rows: any[]) => rows.filter(p => p.held + p.gained + p.lost + p.split_gained + p.split_lost > 0).map(p => [p.party_id, p.held, p.gained, p.lost, p.split_gained, p.split_lost].join(',')).sort();
      if (!isDeepStrictEqual(hg(l.tally.parties), hg(fin.election.parties))) bad.push(`${e.id} parties`);
    }
    expect(seats).toBeGreaterThan(10_000);
    expect(bad.slice(0, 20)).toEqual([]);
  }), 600_000);
});
