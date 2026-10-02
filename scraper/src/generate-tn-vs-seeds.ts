/**
 * Generate Tamil Nadu Vidhan Sabha seed SQL files for 2011, 2016, 2021.
 *
 * Reads JSON data from database/data/tn_vs_{year}.json and GeoJSON from
 * frontend/public/geo/tn_ac_2008.geojson for canonical names + categories.
 *
 * Usage: npx ts-node src/generate-tn-vs-seeds.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATE_ID = 31; // Tamil Nadu

interface YearConfig {
  year: number;
  electionId: string;
  constPrefix: string;
  electionName: string;
  manifest: object;
}

const YEAR_CONFIGS: YearConfig[] = [
  {
    year: 2011,
    electionId: 'e5f6a7b8-c9d0-1234-ef01-456789012011',
    constPrefix: 'TN_VS11',
    electionName: 'Tamil Nadu Vidhan Sabha 2011',
    manifest: {
      alliances: [
        {
          id: 'ADMK',
          name: 'AIADMK+',
          color: '#00AA00',
          parties: ['AIADMK', 'DMDK', 'PMK', 'CPI', 'CPIM', 'PT', 'MAMAK'],
        },
        {
          id: 'DMKALL',
          name: 'DMK+',
          color: '#CC0000',
          parties: ['DMK', 'INC', 'VCK', 'AIFB'],
        },
      ],
      leaders: [
        { name: 'J. Jayalalithaa', party_id: 'AIADMK', const_id: 'TN_VS11_159_SRIRANGAM' },
        { name: 'M. Karunanidhi', party_id: 'DMK', const_id: 'TN_VS11_138_THIRUVARUR' },
      ],
      cabinet: [],
      tracked: ['ADMK', 'DMKALL'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 118 }],
      geo: {
        map_url: '/geo/tn_ac_2008.geojson',
        center: [78.6, 11.0],
        zoom: 7,
      },
      delimitation_era: '2008',
    },
  },
  {
    year: 2016,
    electionId: 'e5f6a7b8-c9d0-1234-ef01-456789012016',
    constPrefix: 'TN_VS16',
    electionName: 'Tamil Nadu Vidhan Sabha 2016',
    manifest: {
      alliances: [
        {
          id: 'ADMK',
          name: 'AIADMK+',
          color: '#00AA00',
          parties: ['AIADMK'],
        },
        {
          id: 'DMKALL',
          name: 'DMK+',
          color: '#CC0000',
          parties: ['DMK', 'INC', 'IUML', 'PT', 'VCK', 'MAMAK', 'PMK'],
        },
        {
          id: 'NDA',
          name: 'NDA',
          color: '#FF6B00',
          parties: ['BJP'],
        },
      ],
      leaders: [
        { name: 'J. Jayalalithaa', party_id: 'AIADMK', const_id: 'TN_VS16_1_GUMMIDIPOONDI' },
        { name: 'M. Karunanidhi', party_id: 'DMK', const_id: 'TN_VS16_138_THIRUVARUR' },
      ],
      cabinet: [],
      tracked: ['ADMK', 'DMKALL', 'NDA'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 118 }],
      compare_with: ['e5f6a7b8-c9d0-1234-ef01-456789012011'],
      geo: {
        map_url: '/geo/tn_ac_2008.geojson',
        center: [78.6, 11.0],
        zoom: 7,
      },
      delimitation_era: '2008',
    },
  },
  {
    year: 2021,
    electionId: 'e5f6a7b8-c9d0-1234-ef01-456789012021',
    constPrefix: 'TN_VS21',
    electionName: 'Tamil Nadu Vidhan Sabha 2021',
    manifest: {
      alliances: [
        {
          id: 'DMKALL',
          name: 'DMK+',
          color: '#CC0000',
          parties: ['DMK', 'INC', 'VCK', 'CPI', 'CPIM'],
        },
        {
          id: 'ADMK',
          name: 'AIADMK+',
          color: '#00AA00',
          parties: ['AIADMK', 'BJP', 'PMK'],
        },
        {
          id: 'MNM',
          name: 'MNM',
          color: '#FF4081',
          parties: ['MNM', 'AMMK'],
        },
      ],
      leaders: [
        { name: 'M.K. Stalin', party_id: 'DMK', const_id: 'TN_VS21_82_KOLATHUR' },
        { name: 'Edappadi K. Palaniswami', party_id: 'AIADMK', const_id: 'TN_VS21_94_EDAPPADI' },
      ],
      cabinet: [],
      tracked: ['DMKALL', 'ADMK', 'MNM'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 118 }],
      compare_with: ['e5f6a7b8-c9d0-1234-ef01-456789012016'],
      history: [
        'e5f6a7b8-c9d0-1234-ef01-456789012011',
        'e5f6a7b8-c9d0-1234-ef01-456789012016',
      ],
      history_years: [2011, 2016],
      vote_splits: [
        { spoiler: 'MNM', hurts: 'DMKALL', label: 'MNM split' },
        { spoiler: 'AMMK', hurts: 'ADMK', label: 'AMMK split' },
      ],
      geo: {
        map_url: '/geo/tn_ac_2008.geojson',
        center: [78.6, 11.0],
        zoom: 7,
      },
      delimitation_era: '2008',
    },
  },
];

/** Map JSON party abbreviation → DB party ID */
const PARTY_MAP: Record<string, string> = {
  AIADMK: 'AIADMK',
  DMK: 'DMK',
  DMDK: 'DMDK',
  INC: 'INC',
  BJP: 'BJP',
  CPI: 'CPI',
  CPM: 'CPIM',
  PMK: 'PMK',
  VCK: 'VCK',
  AIFB: 'AIFB',
  IUML: 'IUML',
  AMMK: 'AMMK',
  MNM: 'MNM',
  PT: 'PT',
  MAMAK: 'MAMAK',
  KNMK: 'KNMK',
  IND: 'IND',
  BSP: 'BSP',
  NCP: 'NCP',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function makeConstId(prefix: string, constNo: number, geoName: string): string {
  const clean = geoName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `${prefix}_${constNo}_${clean}`;
}

interface JsonCandidate {
  name: string;
  party: string;
  votes?: number;
}

interface JsonResult {
  const_no: number;
  const_name: string;
  winner: JsonCandidate;
  runner_up: JsonCandidate;
  margin: number;
  all_candidates?: JsonCandidate[];
}

interface GeoEntry {
  name: string;
  category: string;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== Tamil Nadu Vidhan Sabha Seed Generator ===\n');

  // Load GeoJSON
  const geoPath = path.resolve(__dirname, '../../frontend/public/geo/tn_ac_2008.geojson');
  const geoData = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
  const geoMap: Record<number, GeoEntry> = {};
  for (const feat of geoData.features) {
    const p = feat.properties;
    // Skip duplicate ac_no 169 (take first)
    if (geoMap[p.ac_no]) continue;
    geoMap[p.ac_no] = { name: p.ac_name, category: p.ac_category || 'GEN' };
  }

  for (const config of YEAR_CONFIGS) {
    generateSeed(config, geoMap);
  }
}

function generateSeed(config: YearConfig, geoMap: Record<number, GeoEntry>) {
  const { year, electionId, constPrefix, electionName } = config;

  // Load JSON data
  const jsonPath = path.resolve(__dirname, `../../database/data/tn_vs_${year}.json`);
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const results: JsonResult[] = jsonData.results;
  const hasVotes = results[0]?.winner?.votes != null;

  console.log(`--- ${electionName} (${results.length} seats, votes=${hasVotes}) ---`);

  const lines: string[] = [];
  lines.push(`-- ${electionName} Election Data`);
  lines.push(`-- Source: ECI / elections.in (winner + runner-up per constituency)`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_tn_vs_${year}.sql`);
  lines.push('');

  // Election
  lines.push('-- Election');
  lines.push(`INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date) VALUES`);
  lines.push(`  ('${electionId}', '${esc(electionName)}', 'VS', ${STATE_ID}, ${year}, 'Finalized', NULL)`);
  lines.push(`ON CONFLICT (id) DO NOTHING;`);
  lines.push('');

  // Constituencies
  lines.push(`-- Constituencies (${results.length})`);
  lines.push('INSERT INTO constituencies (id, election_id, district_id, state_id, name, const_no, type, voter_turnout, phase, total_electors) VALUES');
  const constLines: string[] = [];
  for (const r of results) {
    const geo = geoMap[r.const_no];
    if (!geo) {
      console.warn(`  WARNING: No GeoJSON entry for const_no ${r.const_no} (${r.const_name})`);
      continue;
    }
    const constId = makeConstId(constPrefix, r.const_no, geo.name);
    const displayName = geo.name
      .split(' ')
      .map((w: string) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
    constLines.push(
      `  ('${esc(constId)}', '${electionId}', NULL, ${STATE_ID}, '${esc(displayName)}', ${r.const_no}, '${geo.category}', NULL, NULL, NULL)`
    );
  }
  lines.push(constLines.join(',\n') + '\nON CONFLICT DO NOTHING;');
  lines.push('');

  // Candidates + Results
  const hasAllCandidates = results[0]?.all_candidates != null;
  lines.push(`-- Candidates (${hasAllCandidates ? 'all candidates' : 'winner + runner-up'} per constituency)`);
  const candidateInserts: string[] = [];
  const resultInserts: string[] = [];
  let totalCandidates = 0;

  for (const r of results) {
    const geo = geoMap[r.const_no];
    if (!geo) continue;
    const constId = makeConstId(constPrefix, r.const_no, geo.name);
    const margin = r.margin;

    if (hasAllCandidates && r.all_candidates) {
      const sorted = r.all_candidates.slice().sort((a, b) => (b.votes || 0) - (a.votes || 0));
      for (let idx = 0; idx < sorted.length; idx++) {
        const cand = sorted[idx];
        const partyId = PARTY_MAP[cand.party] || 'IND';
        if (!PARTY_MAP[cand.party]) {
          console.warn(`  WARNING: Unknown party '${cand.party}' in const ${r.const_no}`);
        }
        const status = idx === 0 ? 'WON' : 'LOST';
        const candId = randomUUID();
        candidateInserts.push(
          `  ('${candId}', NULL, '${electionId}', '${esc(constId)}', '${esc(partyId)}', '${esc(cand.name)}', FALSE)`
        );
        resultInserts.push(
          `  ('${randomUUID()}', '${candId}', '${esc(constId)}', ${cand.votes || 0}, '${status}', ${idx === 0 ? margin : 0}, 0, '${electionId}')`
        );
        totalCandidates++;
      }
    } else {
      // Legacy: winner + runner-up only
      const winnerPartyId = PARTY_MAP[r.winner.party] || 'IND';
      const runnerUpPartyId = PARTY_MAP[r.runner_up.party] || 'IND';

      if (!PARTY_MAP[r.winner.party]) {
        console.warn(`  WARNING: Unknown party '${r.winner.party}' in const ${r.const_no}`);
      }
      if (!PARTY_MAP[r.runner_up.party]) {
        console.warn(`  WARNING: Unknown party '${r.runner_up.party}' in const ${r.const_no}`);
      }

      let winnerVotes: number;
      let runnerUpVotes: number;
      if (hasVotes) {
        winnerVotes = r.winner.votes!;
        runnerUpVotes = r.runner_up.votes!;
      } else {
        // Margin-only data: synthetic votes
        runnerUpVotes = 50000;
        winnerVotes = runnerUpVotes + margin;
      }

      const winCandId = randomUUID();
      candidateInserts.push(
        `  ('${winCandId}', NULL, '${electionId}', '${esc(constId)}', '${esc(winnerPartyId)}', '${esc(r.winner.name)}', FALSE)`
      );
      resultInserts.push(
        `  ('${randomUUID()}', '${winCandId}', '${esc(constId)}', ${winnerVotes}, 'WON', ${margin}, 0, '${electionId}')`
      );
      totalCandidates++;

      const ruCandId = randomUUID();
      candidateInserts.push(
        `  ('${ruCandId}', NULL, '${electionId}', '${esc(constId)}', '${esc(runnerUpPartyId)}', '${esc(r.runner_up.name)}', FALSE)`
      );
      resultInserts.push(
        `  ('${randomUUID()}', '${ruCandId}', '${esc(constId)}', ${runnerUpVotes}, 'LOST', ${margin}, 0, '${electionId}')`
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

  // Manifest
  lines.push('-- Manifest');
  lines.push(`UPDATE elections SET manifest_url = '${esc(JSON.stringify(config.manifest))}' WHERE id = '${electionId}';`);
  lines.push('');

  // Write
  const outPath = path.resolve(__dirname, `../../database/seed_tn_vs_${year}.sql`);
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`  Wrote ${outPath}`);
  console.log(`  ${results.length} constituencies, ${totalCandidates} candidates\n`);
}

main();
