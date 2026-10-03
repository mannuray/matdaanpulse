/**
 * Scrape Bihar Vidhan Sabha 2025 results from ECI and generate seed SQL.
 *
 * Usage: npx ts-node src/generate-bihar-vs-seed.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  fetchConstituencyList,
  fetchConstituencyDetail,
  makeConstId,
  type ConstituencySummary,
  type CandidateDetail,
} from './adapters/eci-vs-adapter';

const ELECTION_ID = 'c3d4e5f6-a7b8-9012-cdef-234567890abc';
const STATE_ID = 5; // Bihar

/** Known party name → ID mapping (from existing seed) */
const PARTY_NAME_TO_ID: Record<string, string> = {
  'Bharatiya Janata Party': 'BJP',
  'Indian National Congress': 'INC',
  'Janata Dal (United)': 'JDU',
  'Rashtriya Janata Dal': 'RJD',
  'Lok Janshakti Party(Ram Vilas)': 'LJPRV',
  'Lok Janshakti Party (Ram Vilas)': 'LJPRV',
  'Hindustani Awam Morcha': 'HAM',
  'Hindustani Awam Morcha (Secular)': 'HAMS',
  'Bahujan Samaj Party': 'BSP',
  'Aam Aadmi Party': 'AAP',
  'Communist Party of India  (Marxist)': 'CPIM',
  'Communist Party of India (Marxist)': 'CPIM',
  'Communist Party of India': 'CPI',
  'Communist Party of India (Marxist-Leninist) (Liberation)': 'CPIML',
  'All India Majlis-E-Ittehadul Muslimeen': 'AIMIM',
  'All India Forward Bloc': 'AIFB',
  'Nationalist Congress Party - Sharadchandra Pawar': 'NCPSP',
  'Nationalist Congress Party': 'NCP',
  'AJSU Party': 'AP1',
  'Jharkhand Mukti Morcha': 'JMM',
  'Rashtriya Lok Morcha': 'RLM',
  'Bhagidari Party(P)': 'BP',
  'Independent': 'IND',
  'None of the Above': 'NOTA',
};

/** Generate a short ID from a party name */
function generatePartyId(name: string): string {
  // Take first letters of each word, uppercase
  const words = name.replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/);
  let id = words.map((w) => w[0]).join('').toUpperCase();
  if (id.length < 2) id = name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
  return id;
}

/** Escape single quotes for SQL */
function esc(s: string): string {
  return s.replace(/'/g, "''");
}

/** Known party colors for major Bihar parties */
const PARTY_COLORS: Record<string, string> = {
  BJP: '#FF6B00',
  INC: '#00BFFF',
  JDU: '#003366',
  RJD: '#2E8B57',
  LJPRV: '#0000CD',
  HAM: '#228B22',
  BSP: '#0033CC',
  AAP: '#0066FF',
  CPIM: '#FF0000',
  CPI: '#FF0000',
  CPIML: '#CC0000',
  AIMIM: '#008000',
  NCP: '#004080',
  NCPSP: '#004080',
  IND: '#808080',
  NOTA: '#000000',
};

async function main() {
  console.log('=== Bihar Vidhan Sabha 2025 Seed Generator ===\n');

  // Step 1: Fetch constituency list
  console.log('Step 1: Fetching constituency list from ECI...');
  const constituencies = await fetchConstituencyList();
  console.log(`  Found ${constituencies.length} constituencies\n`);

  if (constituencies.length !== 243) {
    console.warn(`  WARNING: Expected 243 constituencies, got ${constituencies.length}`);
  }

  // Step 2: Fetch candidate details for each constituency
  console.log('Step 2: Fetching candidate details...');
  const detailMap = new Map<number, CandidateDetail[]>();
  for (let i = 0; i < constituencies.length; i++) {
    const c = constituencies[i];
    console.log(`  [${i + 1}/${constituencies.length}] ${c.name} (#${c.constNo})`);
    const detail = await fetchConstituencyDetail(c.constNo);
    detailMap.set(c.constNo, detail);
    // Rate limiting: 200ms between requests
    if (i < constituencies.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Step 3: Build party mapping
  console.log('\nStep 3: Building party mapping...');
  const allPartyNames = new Set<string>();
  for (const [, candidates] of detailMap) {
    for (const c of candidates) {
      allPartyNames.add(c.party);
    }
  }

  // Also add parties from summary (in case detail page missed some)
  for (const c of constituencies) {
    allPartyNames.add(c.winnerParty);
    allPartyNames.add(c.runnerUpParty);
  }

  /** IDs known to exist in the original seed.sql (subset — only those we map to) */
  const EXISTING_IN_SEED = new Set([
    'BJP', 'INC', 'JDU', 'RJD', 'LJPRV', 'HAM', 'BSP', 'AAP', 'CPIM', 'CPI',
    'AIMIM', 'AIFB', 'NCPSP', 'NCP', 'AP1', 'JMM', 'RLM', 'BP', 'IND', 'NOTA',
  ]);

  const partyMap = new Map<string, string>(); // name -> id
  const newParties: { id: string; name: string; color: string }[] = [];
  const usedIds = new Set(Object.values(PARTY_NAME_TO_ID));

  for (const name of allPartyNames) {
    if (!name) continue;
    if (PARTY_NAME_TO_ID[name]) {
      const id = PARTY_NAME_TO_ID[name];
      partyMap.set(name, id);
      // If this mapped ID doesn't exist in the original seed, emit it as a new party
      if (!EXISTING_IN_SEED.has(id)) {
        const color = PARTY_COLORS[id] || '#808080';
        newParties.push({ id, name, color });
        console.log(`  Mapped party (new to DB): ${name} -> ${id}`);
      }
    } else {
      // New party - generate ID
      let id = generatePartyId(name);
      let suffix = 1;
      while (usedIds.has(id)) {
        id = generatePartyId(name) + suffix;
        suffix++;
      }
      usedIds.add(id);
      partyMap.set(name, id);
      newParties.push({ id, name, color: '#808080' });
      console.log(`  New party: ${name} -> ${id}`);
    }
  }

  // Step 4: Generate SQL
  console.log(`\nStep 4: Generating SQL...`);
  const lines: string[] = [];

  lines.push('-- Bihar Vidhan Sabha 2025 Election Data');
  lines.push('-- Scraped from Election Commission of India results');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_bihar_vs_2025.sql');
  lines.push('');

  // New parties
  if (newParties.length > 0) {
    lines.push('-- New parties (not in existing seed)');
    for (const p of newParties) {
      lines.push(`INSERT INTO parties (id, name, color, symbol_url) VALUES ('${esc(p.id)}', '${esc(p.name)}', '${p.color}', NULL) ON CONFLICT (id) DO NOTHING;`);
    }
    lines.push('');
  }

  // Election
  lines.push('-- Election');
  lines.push(`INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date) VALUES`);
  lines.push(`  ('${ELECTION_ID}', 'Bihar Vidhan Sabha 2025', 'VS', ${STATE_ID}, 2025, 'Finalized', NULL)`);
  lines.push(`ON CONFLICT (id) DO NOTHING;`);
  lines.push('');

  // Constituencies
  lines.push('-- Constituencies (243)');
  lines.push('INSERT INTO constituencies (id, election_id, district_id, state_id, name, const_no, type, voter_turnout, phase, total_electors) VALUES');
  const constLines: string[] = [];
  for (const c of constituencies) {
    const constId = makeConstId(c.name, c.constNo);
    // Extract SC/ST category from constituency name if present (e.g. "Ramnagar (SC)")
    const catMatch = c.name.match(/\((SC|ST)\)\s*$/i);
    const constType = catMatch ? catMatch[1].toUpperCase() : 'GEN';
    constLines.push(`  ('${esc(constId)}', '${ELECTION_ID}', NULL, ${STATE_ID}, '${esc(c.name)}', ${c.constNo}, '${constType}', NULL, NULL, NULL)`);
  }
  lines.push(constLines.join(',\n') + '\nON CONFLICT DO NOTHING;');
  lines.push('');

  // Candidates and Results
  lines.push('-- Candidates');
  const candidateInserts: string[] = [];
  const resultInserts: string[] = [];
  let totalCandidates = 0;

  for (const c of constituencies) {
    const constId = makeConstId(c.name, c.constNo);
    const candidates = detailMap.get(c.constNo) || [];

    // Take top 5 candidates + NOTA
    const top = candidates.filter((cand) => cand.name !== 'NOTA').slice(0, 5);
    const nota = candidates.find((cand) => cand.name === 'NOTA');
    if (nota) top.push(nota);

    for (const cand of top) {
      const candId = randomUUID();
      const partyId = partyMap.get(cand.party) || 'IND';
      const isNota = cand.name === 'NOTA';
      const status = cand.status === 'won' ? 'WON' : 'LOST';
      const margin = Math.abs(cand.margin);

      candidateInserts.push(
        `  ('${candId}', NULL, '${ELECTION_ID}', '${esc(constId)}', '${esc(partyId)}', '${esc(cand.name)}', FALSE)`
      );
      resultInserts.push(
        `  ('${randomUUID()}', '${candId}', '${esc(constId)}', ${cand.votes}, '${isNota ? 'LOST' : status}', ${margin}, 0, '${ELECTION_ID}')`
      );
      totalCandidates++;
    }
  }

  lines.push('INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent) VALUES');
  lines.push(candidateInserts.join(',\n') + '\nON CONFLICT DO NOTHING;');
  lines.push('');

  lines.push('-- Results');
  lines.push('INSERT INTO results (id, candidate_id, const_id, votes, status, margin, round_no, election_id) VALUES');
  lines.push(resultInserts.join(',\n') + '\nON CONFLICT DO NOTHING;');
  lines.push('');

  // Manifest JSON
  const manifest = {
    alliances: [
      {
        id: 'NDA',
        name: 'National Democratic Alliance',
        color: '#FF6B00',
        parties: ['BJP', 'JDU', 'LJPRV', 'HAMS', 'RLM'],
      },
      {
        id: 'MGB',
        name: 'Mahagathbandhan',
        color: '#2E8B57',
        parties: ['RJD', 'INC', 'CPIM', 'CPI', 'CPIML'],
      },
    ],
    leaders: [
      { name: 'Nitish Kumar', party_id: 'JDU', const_id: '' },
      { name: 'Tejashwi Yadav', party_id: 'RJD', const_id: '' },
    ],
    cabinet: [],
    tracked: ['NDA', 'MGB', 'AIMIM', 'BSP'],
    vip_seats: {},
    milestones: [{ label: 'Majority', value: 122 }],
    compare_with: [],
    vote_splits: [
      { spoiler: 'AIMIM', hurts: 'MGB', label: 'AIMIM split' },
      { spoiler: 'BSP', hurts: 'MGB', label: 'BSP split' },
    ],
    geo: {
      map_url: '/geo/bihar_ac_2008.geojson',
      center: [85.5, 25.6] as [number, number],
      zoom: 8,
    },
  };

  lines.push('-- Manifest');
  lines.push(`UPDATE elections SET manifest_url = '${esc(JSON.stringify(manifest))}' WHERE id = '${ELECTION_ID}';`);
  lines.push('');

  // Write file
  const outPath = path.resolve(__dirname, '../../database/seed_bihar_vs_2025.sql');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\nDone! Wrote ${outPath}`);
  console.log(`  ${constituencies.length} constituencies`);
  console.log(`  ${totalCandidates} candidates`);
  console.log(`  ${newParties.length} new parties`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
