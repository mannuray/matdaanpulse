/**
 * Generate affidavit data seed SQL by scraping MyNeta.info.
 *
 * Queries the DB for candidates (with person_id), scrapes MyNeta,
 * matches by const_no + name, generates UPDATE statements for both
 * candidates.metadata.affidavit and persons.metadata.affidavit_history.
 *
 * Usage:
 *   cd scraper
 *   npx tsx src/generate-affidavit-seed.ts <myneta-slug> <election-id>
 *
 * Examples:
 *   npx tsx src/generate-affidavit-seed.ts Bihar2025 c3d4e5f6-a7b8-9012-cdef-234567890abc
 *   npx tsx src/generate-affidavit-seed.ts WestBengal2021 d4e5f6a7-b8c9-0123-def0-345678901021
 */
import * as fs from 'fs';
import * as path from 'path';
import { pool, query } from './db';
import {
  fetchConstituencyIds,
  fetchCandidateList,
  fetchCandidateDetail,
  parseRupeeAmount,
  type AffidavitData,
} from './adapters/myneta-adapter';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const SLUG = process.argv[2];
const ELECTION_ID = process.argv[3];

if (!SLUG || !ELECTION_ID) {
  console.error('Usage: npx tsx src/generate-affidavit-seed.ts <myneta-slug> <election-id>');
  console.error('  e.g. npx tsx src/generate-affidavit-seed.ts Bihar2025 c3d4e5f6-a7b8-9012-cdef-234567890abc');
  process.exit(1);
}

const OUTPUT_PATH = path.resolve(
  __dirname,
  `../../database/seed_affidavit_${SLUG.toLowerCase()}.sql`,
);

// ---------------------------------------------------------------------------
// Name normalization + matching
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s*\(.*?\)\s*/g, '') // strip parenthetical (alias)
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function jsonEsc(obj: object): string {
  return esc(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// DB types
// ---------------------------------------------------------------------------

interface DbCandidate {
  id: string;
  personId: string | null;
  constId: string;
  constNo: number;
  name: string;
  partyId: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`=== Affidavit Seed Generator ===`);
  console.log(`  MyNeta slug: ${SLUG}`);
  console.log(`  Election ID: ${ELECTION_ID}\n`);

  // Step 1: Query DB for candidates
  console.log('Step 1: Querying DB for candidates...');
  const { rows } = await query(
    `SELECT c.id, c.person_id, c.const_id, co.const_no, c.name, c.party_id
     FROM candidates c
     JOIN constituencies co ON co.id = c.const_id
     WHERE c.election_id = $1
     ORDER BY co.const_no`,
    [ELECTION_ID],
  );

  if (rows.length === 0) {
    console.error(`No candidates found for election ${ELECTION_ID}. Check your election ID.`);
    process.exit(1);
  }

  const dbCandidates: DbCandidate[] = rows.map((r: any) => ({
    id: r.id,
    personId: r.person_id,
    constId: r.const_id,
    constNo: r.const_no,
    name: r.name,
    partyId: r.party_id,
  }));

  const linkedCount = dbCandidates.filter((c) => c.personId).length;
  console.log(`  Found ${dbCandidates.length} candidates (${linkedCount} linked to persons)\n`);

  if (linkedCount === 0) {
    console.warn('  WARNING: No candidates linked to persons. Run auto-link first for person-level tracking.');
    console.warn('  Continuing — will only update candidates.metadata.\n');
  }

  // Group by const_no
  const dbByConstNo = new Map<number, DbCandidate[]>();
  for (const c of dbCandidates) {
    if (!dbByConstNo.has(c.constNo)) dbByConstNo.set(c.constNo, []);
    dbByConstNo.get(c.constNo)!.push(c);
  }

  // Step 2: Fetch constituency list from MyNeta
  console.log('Step 2: Fetching constituency list from MyNeta...');
  const constIds = await fetchConstituencyIds(SLUG);
  console.log(`  Found ${constIds.length} constituencies\n`);

  // Step 3: Scrape and match
  console.log('Step 3: Scraping candidate details and matching...');

  interface MatchResult {
    dbCandidate: DbCandidate;
    affidavit: AffidavitData;
    matchType: 'exact' | 'fuzzy';
  }

  const matches: MatchResult[] = [];
  const unmatched: { name: string; constituency: string; constituencyId: number }[] = [];
  let totalMyNeta = 0;

  for (let i = 0; i < constIds.length; i++) {
    const constEntry = constIds[i];
    console.log(
      `  [${i + 1}/${constIds.length}] Constituency ${constEntry.id}: ${constEntry.name}`,
    );

    const myNetaCandidates = await fetchCandidateList(SLUG, constEntry.id);
    totalMyNeta += myNetaCandidates.length;

    // MyNeta constituency_id = const_no
    const dbForConst = dbByConstNo.get(constEntry.id) || [];

    for (const mnc of myNetaCandidates) {
      const normalizedMnName = normalizeName(mnc.name);

      // Exact match
      let matched = dbForConst.find(
        (dc) => normalizeName(dc.name) === normalizedMnName,
      );
      let matchType: 'exact' | 'fuzzy' = 'exact';

      // Fuzzy fallback
      if (!matched) {
        let bestDist = Infinity;
        let bestMatch: DbCandidate | undefined;
        for (const dc of dbForConst) {
          const dist = levenshtein(normalizeName(dc.name), normalizedMnName);
          if (dist < bestDist) {
            bestDist = dist;
            bestMatch = dc;
          }
        }
        if (bestMatch && bestDist <= 3) {
          matched = bestMatch;
          matchType = 'fuzzy';
        }
      }

      if (!matched) {
        unmatched.push({
          name: mnc.name,
          constituency: mnc.constituency,
          constituencyId: constEntry.id,
        });
        continue;
      }

      // Fetch detailed affidavit data
      try {
        const affidavit = await fetchCandidateDetail(SLUG, mnc.candidateId);

        // Fallback: use list-page summary when detail page has JS-rendered data
        if (!affidavit.total_assets && mnc.totalAssets) {
          affidavit.total_assets = parseRupeeAmount(mnc.totalAssets);
        }
        if (!affidavit.liabilities && mnc.liabilities) {
          affidavit.liabilities = parseRupeeAmount(mnc.liabilities);
        }
        if (!affidavit.criminal_cases && mnc.criminalCases) {
          affidavit.criminal_cases = mnc.criminalCases;
        }
        if (!affidavit.education && mnc.education) {
          affidavit.education = mnc.education;
        }
        if (!affidavit.age && mnc.age) {
          affidavit.age = mnc.age;
        }

        matches.push({ dbCandidate: matched, affidavit, matchType });
      } catch (err) {
        console.log(`    WARN: Failed to fetch detail for ${mnc.name}: ${err}`);
      }
    }
  }

  // Step 4: Generate SQL
  const exactCount = matches.filter((m) => m.matchType === 'exact').length;
  const fuzzyCount = matches.filter((m) => m.matchType === 'fuzzy').length;
  const personMatches = matches.filter((m) => m.dbCandidate.personId);

  console.log(`\nStep 4: Generating SQL...`);
  console.log(`  Matched: ${matches.length} (exact: ${exactCount}, fuzzy: ${fuzzyCount})`);
  console.log(`  With person_id: ${personMatches.length}`);
  console.log(`  Unmatched: ${unmatched.length}`);

  const lines: string[] = [];
  lines.push(`-- Affidavit data for ${SLUG}`);
  lines.push(`-- Source: MyNeta.info (Association for Democratic Reforms)`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Election: ${ELECTION_ID}`);
  lines.push(`-- Matched: ${matches.length}/${totalMyNeta} MyNeta candidates (${exactCount} exact, ${fuzzyCount} fuzzy)`);
  lines.push(`-- Person updates: ${personMatches.length}`);
  lines.push(`-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_affidavit_${SLUG.toLowerCase()}.sql`);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // -- Candidate updates
  lines.push('-- Candidate affidavit data');
  for (const m of matches) {
    const aff = {
      criminal_cases: m.affidavit.criminal_cases,
      serious_ipc: m.affidavit.serious_ipc,
      ipc_sections: m.affidavit.ipc_sections,
      total_assets: m.affidavit.total_assets,
      movable_assets: m.affidavit.movable_assets,
      immovable_assets: m.affidavit.immovable_assets,
      liabilities: m.affidavit.liabilities,
      education: m.affidavit.education,
      profession: m.affidavit.profession,
      age: m.affidavit.age,
      source_url: m.affidavit.source_url,
    };

    lines.push(
      `UPDATE candidates SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{affidavit}', '${jsonEsc(aff)}') WHERE id = '${m.dbCandidate.id}';`,
    );
  }

  // -- Person updates (affidavit_history keyed by election_id)
  if (personMatches.length > 0) {
    lines.push('');
    lines.push('-- Person affidavit history (keyed by election_id)');
    lines.push(`-- Ensures affidavit_history object exists, then sets the election entry`);

    // Group by person_id (a person might have multiple candidacies, though unlikely)
    const byPerson = new Map<string, MatchResult[]>();
    for (const m of personMatches) {
      const pid = m.dbCandidate.personId!;
      if (!byPerson.has(pid)) byPerson.set(pid, []);
      byPerson.get(pid)!.push(m);
    }

    for (const [personId, personMatches] of byPerson) {
      // Use the first match (one person = one candidacy per election)
      const m = personMatches[0];
      const aff = {
        criminal_cases: m.affidavit.criminal_cases,
        serious_ipc: m.affidavit.serious_ipc,
        total_assets: m.affidavit.total_assets,
        movable_assets: m.affidavit.movable_assets,
        immovable_assets: m.affidavit.immovable_assets,
        liabilities: m.affidavit.liabilities,
        education: m.affidavit.education,
        profession: m.affidavit.profession,
        age: m.affidavit.age,
        source_url: m.affidavit.source_url,
      };

      // First ensure affidavit_history key exists, then set the election entry
      lines.push(
        `UPDATE persons SET metadata = jsonb_set(jsonb_set(COALESCE(metadata, '{}'), '{affidavit_history}', COALESCE(metadata->'affidavit_history', '{}'), true), '{affidavit_history,${ELECTION_ID}}', '${jsonEsc(aff)}') WHERE id = '${personId}';`,
      );
    }
  }

  lines.push('');
  lines.push('COMMIT;');

  // Write output
  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');
  console.log(`\nWrote ${OUTPUT_PATH}`);

  const candidateUpdates = matches.length;
  const personUpdates = new Set(personMatches.map((m) => m.dbCandidate.personId)).size;
  console.log(`  ${candidateUpdates} candidate UPDATE statements`);
  console.log(`  ${personUpdates} person UPDATE statements`);

  // Match report
  if (unmatched.length > 0) {
    console.log(`\n--- Unmatched MyNeta Candidates (${unmatched.length}) ---`);
    const byConst = new Map<number, string[]>();
    for (const u of unmatched) {
      if (!byConst.has(u.constituencyId)) byConst.set(u.constituencyId, []);
      byConst.get(u.constituencyId)!.push(u.name);
    }
    for (const [constId, names] of byConst) {
      console.log(`  Const ${constId}: ${names.join(', ')}`);
    }
  }

  const fuzzyMatches = matches.filter((m) => m.matchType === 'fuzzy');
  if (fuzzyMatches.length > 0) {
    console.log(`\n--- Fuzzy Matches (${fuzzyMatches.length}) ---`);
    for (const m of fuzzyMatches) {
      console.log(`  DB: "${m.dbCandidate.name}" ← MyNeta (fuzzy, dist ≤ 3)`);
    }
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await pool.end();
  process.exit(1);
});
