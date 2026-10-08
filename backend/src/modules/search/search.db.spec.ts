/**
 * Typo-tolerant search against the local database (migration 028, pg_trgm) and the seeded Bihar 2025 election.
 * Without a reachable database the tests print a "SKIPPED" warning and pass; REQUIRE_DB_TESTS=1 makes that a failure.
 */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { SearchService } from './search.service';

config({ path: join(__dirname, '../../../.env') });

const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('fuzzy search (DB)', () => {
  let prisma: PrismaClient | null = null;
  let svc: SearchService;
  let eid: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      const [row] = await client.$queryRaw<{ id: string }[]>`SELECT id FROM elections WHERE type = 'VS' AND year = 2025 AND name ILIKE '%bihar%' LIMIT 1`;
      if (!row) throw new Error('no Bihar 2025 election');
      eid = row.id;
      prisma = client;
      svc = new SearchService(client as any);
    } catch (e) {
      await client.$disconnect();
      if (REQUIRE_DB) throw e;
    }
  });
  afterAll(() => prisma?.$disconnect());

  const skip = () => {
    if (prisma) return false;
    if (REQUIRE_DB) throw new Error('database required');
    console.warn('SKIPPED: no database');
    return true;
  };
  const seats = async (q: string) => (await svc.searchConstituencies(q, eid)).map((c) => c.name);
  const people = async (q: string) => (await svc.searchCandidates(q, eid)).map((c) => c.name);

  it('finds seats despite spelling mistakes', async () => {
    if (skip()) return;
    expect((await seats('bhagalpoor'))[0]).toBe('BHAGALPUR');
    expect((await seats('valmikinagar'))[0]).toBe('VALMIKI NAGAR');
  });

  it('finds candidates despite spelling mistakes', async () => {
    if (skip()) return;
    expect(await people('tejaswi')).toContain('Tejashwi Prasad Yadav');
  });

  it('an exact name still comes first, ahead of similar spellings', async () => {
    if (skip()) return;
    const out = await seats('danapur');
    expect(out[0]).toBe('DANAPUR');
  });

  it('LIKE wildcards in the query are literal (no match-everything)', async () => {
    if (skip()) return;
    expect(await seats('%%')).toEqual([]);
    expect(await seats('__')).toEqual([]);
  });

  it('stays within the election', async () => {
    if (skip()) return;
    const rows = await svc.searchConstituencies('bhagalpoor', eid);
    expect(rows.every((r) => r.election_id === eid)).toBe(true);
  });
});
