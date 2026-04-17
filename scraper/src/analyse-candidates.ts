/**
 * Cross-election candidate analysis for Bihar.
 *
 * Queries all Bihar VS candidates (2010, 2015, 2020, 2025), groups by
 * normalized name + constituency, and writes a reviewable JSON report.
 *
 * Usage:  npx ts-node src/analyse-candidates.ts
 * Output: scraper/output/bihar-person-matches.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { pool, query } from './db';

// Bihar election IDs (oldest first)
const BIHAR_ELECTION_IDS = [
  'a1b2c3d4-e5f6-7890-abcd-111111111010', // 2010
  'a1b2c3d4-e5f6-7890-abcd-111111111015', // 2015
  'b2c3d4e5-f6a7-8901-bcde-123456789020', // 2020
  'c3d4e5f6-a7b8-9012-cdef-234567890abc', // 2025
];

const YEAR_MAP: Record<string, number> = {
  'a1b2c3d4-e5f6-7890-abcd-111111111010': 2010,
  'a1b2c3d4-e5f6-7890-abcd-111111111015': 2015,
  'b2c3d4e5-f6a7-8901-bcde-123456789020': 2020,
  'c3d4e5f6-a7b8-9012-cdef-234567890abc': 2025,
};

/** Strip ALIAS suffix, uppercase, trim, remove non-alpha chars */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/\s*ALIAS\s+.*$/i, '')
    .replace(/[^A-Z\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Strip BR_VS10_, BR_VS15_, BR_VS20_, BR_VS_ prefixes to get bare const key */
function normalizeConstId(constId: string): string {
  return constId
    .replace(/^BR_VS10_/, '')
    .replace(/^BR_VS15_/, '')
    .replace(/^BR_VS20_/, '')
    .replace(/^BR_VS_/, '');
}

// Common first-name-only patterns that produce false positives
const COMMON_NAMES = new Set([
  'ANIL KUMAR', 'SUNIL KUMAR', 'RAJESH KUMAR', 'RAMESH KUMAR',
  'MANOJ KUMAR', 'VIJAY KUMAR', 'SANJAY KUMAR', 'AJAY KUMAR',
  'RAJU KUMAR', 'MUKESH KUMAR', 'RAKESH KUMAR', 'SANTOSH KUMAR',
  'ASHOK KUMAR', 'DINESH KUMAR', 'PANKAJ KUMAR', 'AMIT KUMAR',
  'RAVI KUMAR', 'MOHD ANWAR', 'RAM KUMAR', 'SHIV KUMAR',
]);

interface CandidateRow {
  id: string;
  name: string;
  election_id: string;
  election_name: string;
  const_id: string;
  party_id: string | null;
  is_incumbent: boolean;
  votes: number;
  status: string;
  person_id: string | null;
}

interface CandidateEntry {
  id: string;
  name: string;
  election: string;
  year: number;
  constituency: string;
  party_id: string | null;
  votes: number;
  status: string;
  is_incumbent: boolean;
  person_id: string | null;
}

interface PersonGroup {
  normalized_name: string;
  constituency: string;
  elections_count: number;
  confidence: 'high' | 'medium' | 'review';
  candidates: CandidateEntry[];
}

async function main() {
  console.log('Fetching Bihar candidates across 4 elections...');

  const { rows } = await query(
    `SELECT
       c.id,
       c.name,
       c.election_id,
       e.name AS election_name,
       c.const_id,
       c.party_id,
       c.is_incumbent,
       c.person_id,
       COALESCE(r.votes, 0) AS votes,
       COALESCE(r.status, 'TRAILING') AS status
     FROM candidates c
     JOIN elections e ON e.id = c.election_id
     LEFT JOIN results r ON r.candidate_id = c.id
     WHERE c.election_id = ANY($1)
     ORDER BY c.name`,
    [BIHAR_ELECTION_IDS]
  );

  console.log(`  Total candidates: ${rows.length}`);

  // Group by (normalized_name, normalized_const_id)
  const groups = new Map<string, CandidateRow[]>();

  for (const row of rows as CandidateRow[]) {
    const nn = normalizeName(row.name);
    const nc = normalizeConstId(row.const_id);
    const key = `${nn}||${nc}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Filter to groups with 2+ distinct elections
  const persons: PersonGroup[] = [];

  // Also track how many distinct constituencies each normalized name appears in
  const nameToConstituencies = new Map<string, Set<string>>();
  for (const [key] of groups) {
    const [nn, nc] = key.split('||');
    if (!nameToConstituencies.has(nn)) nameToConstituencies.set(nn, new Set());
    nameToConstituencies.get(nn)!.add(nc);
  }

  for (const [key, candidates] of groups) {
    const electionIds = new Set(candidates.map(c => c.election_id));
    if (electionIds.size < 2) continue;

    const [nn, nc] = key.split('||');

    const entries: CandidateEntry[] = candidates
      .sort((a, b) => YEAR_MAP[a.election_id] - YEAR_MAP[b.election_id])
      .map(c => ({
        id: c.id,
        name: c.name,
        election: c.election_name,
        year: YEAR_MAP[c.election_id],
        constituency: c.const_id,
        party_id: c.party_id,
        votes: c.votes,
        status: c.status,
        is_incumbent: c.is_incumbent,
        person_id: c.person_id,
      }));

    // Confidence scoring
    const distinctConstituencies = nameToConstituencies.get(nn)?.size ?? 1;
    const parties = new Set(entries.map(e => e.party_id));
    const isCommonName = COMMON_NAMES.has(nn);

    let confidence: 'high' | 'medium' | 'review';
    if (isCommonName && distinctConstituencies > 1) {
      confidence = 'review';
    } else if (distinctConstituencies > 2) {
      confidence = 'review';
    } else if (parties.size === 1) {
      confidence = 'high';
    } else {
      confidence = 'medium'; // party switcher
    }

    persons.push({
      normalized_name: nn,
      constituency: nc,
      elections_count: electionIds.size,
      confidence,
      candidates: entries,
    });
  }

  // Sort: most elections first, then by name
  persons.sort((a, b) => b.elections_count - a.elections_count || a.normalized_name.localeCompare(b.normalized_name));

  const summary = {
    total_groups: persons.length,
    total_candidates: persons.reduce((sum, p) => sum + p.candidates.length, 0),
    in_all_4_elections: persons.filter(p => p.elections_count === 4).length,
    in_3_elections: persons.filter(p => p.elections_count === 3).length,
    in_2_elections: persons.filter(p => p.elections_count === 2).length,
    by_confidence: {
      high: persons.filter(p => p.confidence === 'high').length,
      medium: persons.filter(p => p.confidence === 'medium').length,
      review: persons.filter(p => p.confidence === 'review').length,
    },
  };

  const report = {
    generated_at: new Date().toISOString(),
    summary,
    persons,
  };

  const outPath = path.join(__dirname, '..', 'output', 'bihar-person-matches.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\nSummary:');
  console.log(`  Person groups: ${summary.total_groups}`);
  console.log(`  Total candidates: ${summary.total_candidates}`);
  console.log(`  In all 4 elections: ${summary.in_all_4_elections}`);
  console.log(`  In 3 elections: ${summary.in_3_elections}`);
  console.log(`  In 2 elections: ${summary.in_2_elections}`);
  console.log(`  Confidence — high: ${summary.by_confidence.high}, medium: ${summary.by_confidence.medium}, review: ${summary.by_confidence.review}`);
  console.log(`\nReport written to: ${outPath}`);

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
