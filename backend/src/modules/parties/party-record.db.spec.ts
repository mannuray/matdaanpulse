/** PartiesService.record against the local DB: the record matches the stored analysis it is read from. */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PartiesService } from './parties.service';
import { AuditLogService } from '../audit-log/audit-log.service';

config({ path: join(__dirname, '../../../.env') });
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('party record (DB)', () => {
  let prisma: PrismaClient | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try { await c.$queryRaw`SELECT 1 FROM election_analysis LIMIT 1`; prisma = c; } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  it('BJP in Jharkhand: the latest row equals the stored analysis; one MLA per seat won', async () => {
    if (!prisma) { if (REQUIRE_DB) throw new Error('no DB'); console.warn('SKIPPED (no DB): party record'); return; }
    const svc = new PartiesService(prisma as any, new AuditLogService(prisma as any));
    const r: any = await svc.record('BJP', 'JH');
    const latest = r.elections.find((e: any) => e.state_code === 'JH');
    expect(latest).toBeTruthy();
    const stored: any = (await prisma.election_analysis.findUnique({ where: { election_id: latest.election_id } }))!.data;
    const row = stored.parties.find((p: any) => p.party_id === 'BJP');
    expect({ won: latest.won, contested: latest.contested, share: latest.share }).toEqual({ won: row.won, contested: row.contested, share: row.share });
    expect(r.state.election_id).toBe(latest.election_id);
    expect(r.state.mlas).toHaveLength(latest.won);
    expect(r.elections.every((e: any, i: number, a: any[]) => i === 0 || a[i - 1].date >= e.date)).toBe(true);
  }, 60_000);
});
