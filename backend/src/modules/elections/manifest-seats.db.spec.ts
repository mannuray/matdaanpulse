/**
 * Every seat a manifest names (leaders, watchlist entries; published manifest and draft) exists in that election.
 * A stale const_id makes the leader card look "Pending" in a finished election (resolveLeaderSeats trusts it).
 * Without a reachable database the test prints a "SKIPPED" warning and passes; REQUIRE_DB_TESTS=1 makes that a failure.
 */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: join(__dirname, '../../../.env') });

const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('manifest seat references (DB)', () => {
  let prisma: PrismaClient | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      await client.$queryRaw`SELECT 1`;
      prisma = client;
    } catch (e) {
      await client.$disconnect();
      if (REQUIRE_DB) throw e;
    }
  });
  afterAll(() => prisma?.$disconnect());

  it('no leader or watchlist entry points at a seat missing from its election', async () => {
    if (!prisma) {
      if (REQUIRE_DB) throw new Error('database required');
      console.warn('SKIPPED: no database');
      return;
    }
    const stale = await prisma.$queryRaw<{ election_id: string; source: string; name: string; const_id: string }[]>`
      WITH m AS (
        SELECT id, 'manifest' AS source, manifest_url::jsonb AS doc FROM elections WHERE manifest_url LIKE '{%'
        UNION ALL
        SELECT id, 'draft', manifest_draft FROM elections WHERE jsonb_typeof(manifest_draft) = 'object'
      ), entries AS (
        SELECT m.id, m.source, x FROM m, jsonb_array_elements(COALESCE(m.doc->'leaders', '[]')) x
        UNION ALL
        SELECT m.id, m.source || ':' || (w->>'id'), x FROM m,
          jsonb_array_elements(COALESCE(m.doc->'watchlists', '[]')) w, jsonb_array_elements(COALESCE(w->'entries', '[]')) x
      )
      SELECT e.id::text AS election_id, e.source, e.x->>'name' AS name, e.x->>'const_id' AS const_id
      FROM entries e
      WHERE COALESCE(e.x->>'const_id', '') <> ''
        AND NOT EXISTS (SELECT 1 FROM constituencies c WHERE c.id = e.x->>'const_id' AND c.election_id = e.id)
      ORDER BY 1, 2, 4`;
    expect(stale).toEqual([]);
  });

  it('a named entry\'s seat has that person, or a candidate sharing a word of their name (catches a seat that exists but is wrong)', async () => {
    if (!prisma) {
      if (REQUIRE_DB) throw new Error('database required');
      console.warn('SKIPPED: no database');
      return;
    }
    const wrong = await prisma.$queryRaw<{ election_id: string; name: string; const_id: string }[]>`
      WITH entries AS (
        SELECT e.id, x FROM elections e, jsonb_array_elements(COALESCE(e.manifest_url::jsonb->'leaders', '[]')) x WHERE e.manifest_url LIKE '{%'
        UNION ALL
        SELECT e.id, x FROM elections e, jsonb_array_elements(COALESCE(e.manifest_url::jsonb->'watchlists', '[]')) w,
          jsonb_array_elements(COALESCE(w->'entries', '[]')) x WHERE e.manifest_url LIKE '{%'
      ), named AS (
        SELECT id, x->>'name' AS name, x->>'const_id' AS const_id, x->>'person_id' AS person_id,
          ARRAY(SELECT w FROM unnest(regexp_split_to_array(lower(regexp_replace(x->>'name', '[^A-Za-z ]', '', 'g')), '[[:space:]]+')) w
                WHERE length(w) >= 4) AS words
        FROM entries WHERE COALESCE(x->>'const_id', '') <> '' AND COALESCE(x->>'name', '') <> ''
      )
      SELECT n.id::text AS election_id, n.name, n.const_id FROM named n
      WHERE cardinality(n.words) > 0
        AND EXISTS (SELECT 1 FROM constituencies c WHERE c.id = n.const_id AND c.election_id = n.id)
        AND NOT EXISTS (SELECT 1 FROM candidates ca WHERE ca.const_id = n.const_id
          AND (ca.person_id::text = n.person_id
            OR EXISTS (SELECT 1 FROM unnest(n.words) w WHERE lower(regexp_replace(ca.name, '[^A-Za-z]', '', 'g')) LIKE '%' || w || '%')))
      ORDER BY 1, 3`;
    expect(wrong).toEqual([]);
  });

  it('every person id a manifest names (published or draft) exists (a person merge must remap them)', async () => {
    if (!prisma) {
      if (REQUIRE_DB) throw new Error('database required');
      console.warn('SKIPPED: no database');
      return;
    }
    const missing = await prisma.$queryRaw<{ election_id: string; source: string; name: string; person_id: string }[]>`
      WITH m AS (
        SELECT id, 'manifest' AS source, manifest_url::jsonb AS doc FROM elections WHERE manifest_url LIKE '{%'
        UNION ALL
        SELECT id, 'draft', manifest_draft FROM elections WHERE jsonb_typeof(manifest_draft) = 'object'
      ), entries AS (
        SELECT m.id, m.source, x FROM m, jsonb_array_elements(COALESCE(m.doc->'leaders', '[]')) x
        UNION ALL
        SELECT m.id, m.source || ':' || (w->>'id'), x FROM m,
          jsonb_array_elements(COALESCE(m.doc->'watchlists', '[]')) w, jsonb_array_elements(COALESCE(w->'entries', '[]')) x
      )
      SELECT e.id::text AS election_id, e.source, e.x->>'name' AS name, e.x->>'person_id' AS person_id
      FROM entries e
      WHERE COALESCE(e.x->>'person_id', '') <> ''
        AND NOT EXISTS (SELECT 1 FROM persons p WHERE p.id::text = e.x->>'person_id')
      ORDER BY 1, 2, 4`;
    expect(missing).toEqual([]);
  });
});
