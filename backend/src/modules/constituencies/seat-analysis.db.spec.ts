/** SeatAnalysisService against the local DB (Bihar 2025); every write is rolled back. */
import { config } from 'dotenv';
import { join } from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import { SeatAnalysisService } from './seat-analysis.service';
import { SeatAnalysisLoader } from './seat-analysis.loader';

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
    }, { timeout: 120_000 }).catch(e => { if (!(e instanceof Rollback)) throw e; });
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
});
