/**
 * Generate Assam Vidhan Sabha seed SQL files for 2011, 2016, 2021.
 *
 * Reads JSON data from database/data/as_vs_{year}.json and GeoJSON from
 * frontend/public/geo/as_ac.geojson for canonical names + categories.
 *
 * Usage: npx ts-node src/generate-as-vs-seeds.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATE_ID = 4; // Assam

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
    electionId: 'f6a7b8c9-d0e1-2345-f012-567890122011',
    constPrefix: 'AS_VS11',
    electionName: 'Assam Vidhan Sabha 2011',
    manifest: {
      alliances: [
        {
          id: 'INC',
          name: 'Congress',
          color: '#19AAED',
          parties: ['INC'],
        },
        {
          id: 'AGP',
          name: 'AGP',
          color: '#FFA726',
          parties: ['AGP'],
        },
        {
          id: 'AIUDF',
          name: 'AIUDF',
          color: '#4CAF50',
          parties: ['AIUDF'],
        },
        {
          id: 'BPF',
          name: 'BPF/BOPF',
          color: '#2E7D32',
          parties: ['BOPF'],
        },
      ],
      leaders: [
        { name: 'Tarun Gogoi', party_id: 'INC', const_id: 'AS_VS11_83_TITABAR' },
      ],
      cabinet: [],
      tracked: ['INC', 'AGP', 'AIUDF', 'BPF'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 64 }],
      geo: {
        map_url: '/geo/as_ac.geojson',
        center: [92.9, 26.2],
        zoom: 8,
      },
      delimitation_era: '2008',
    },
  },
  {
    year: 2016,
    electionId: 'f6a7b8c9-d0e1-2345-f012-567890122016',
    constPrefix: 'AS_VS16',
    electionName: 'Assam Vidhan Sabha 2016',
    manifest: {
      alliances: [
        {
          id: 'NDA',
          name: 'NDA',
          color: '#FF6B00',
          parties: ['BJP', 'AGP', 'BPF'],
        },
        {
          id: 'CONGALL',
          name: 'Congress+',
          color: '#19AAED',
          parties: ['INC'],
        },
        {
          id: 'AIUDF',
          name: 'AIUDF',
          color: '#4CAF50',
          parties: ['AIUDF'],
        },
      ],
      leaders: [
        { name: 'Sarbananda Sonowal', party_id: 'BJP', const_id: 'AS_VS16_109_MAJULI' },
        { name: 'Tarun Gogoi', party_id: 'INC', const_id: 'AS_VS16_83_TITABAR' },
      ],
      cabinet: [],
      tracked: ['NDA', 'CONGALL', 'AIUDF'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 64 }],
      compare_with: ['f6a7b8c9-d0e1-2345-f012-567890122011'],
      geo: {
        map_url: '/geo/as_ac.geojson',
        center: [92.9, 26.2],
        zoom: 8,
      },
      delimitation_era: '2008',
    },
  },
  {
    year: 2021,
    electionId: 'f6a7b8c9-d0e1-2345-f012-567890122021',
    constPrefix: 'AS_VS21',
    electionName: 'Assam Vidhan Sabha 2021',
    manifest: {
      alliances: [
        {
          id: 'NDA',
          name: 'NDA',
          color: '#FF6B00',
          parties: ['BJP', 'AGP', 'UPPL'],
        },
        {
          id: 'MGB',
          name: 'Mahajot',
          color: '#19AAED',
          parties: ['INC', 'AIUDF', 'BOPF', 'CPIM'],
        },
      ],
      leaders: [
        { name: 'Himanta Biswa Sarma', party_id: 'BJP', const_id: 'AS_VS21_40_JALUKBARI' },
      ],
      cabinet: [],
      tracked: ['NDA', 'MGB'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 64 }],
      compare_with: ['f6a7b8c9-d0e1-2345-f012-567890122016'],
      history: [
        'f6a7b8c9-d0e1-2345-f012-567890122011',
        'f6a7b8c9-d0e1-2345-f012-567890122016',
      ],
      history_years: [2011, 2016],
      geo: {
        map_url: '/geo/as_ac.geojson',
        center: [92.9, 26.2],
        zoom: 8,
      },
      delimitation_era: '2008',
    },
  },
];

/** Map JSON party abbreviation → DB party ID */
const PARTY_MAP: Record<string, string> = {
  BJP: 'BJP',
  INC: 'INC',
  AGP: 'AGP',
  AIUDF: 'AIUDF',
  BPF: 'BPF',
  BOPF: 'BOPF',
  UPPL: 'UPPL',
  CPI: 'CPI',
  CPM: 'CPIM',
  AITC: 'TMC',
  IND: 'IND',
  NCP: 'NCP',
  BGP: 'BGP',
  BSP: 'BSP',
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
  name?: string;
  party: string;
  votes?: number;
}

interface JsonResult {
  const_no: number;
  const_name: string;
  winner: JsonCandidate;
  runner_up?: JsonCandidate;
  margin: number;
  all_candidates?: JsonCandidate[];
}

interface GeoEntry {
  name: string;
  category: string;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== Assam Vidhan Sabha Seed Generator ===\n');

  // Load GeoJSON
  const geoPath = path.resolve(__dirname, '../../frontend/public/geo/as_ac.geojson');
  const geoData = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
  const geoMap: Record<number, GeoEntry> = {};
  for (const feat of geoData.features) {
    const p = feat.properties;
    if (geoMap[p.ac_no]) continue; // skip duplicates
    geoMap[p.ac_no] = { name: p.ac_name, category: p.ac_category || 'GEN' };
  }

  for (const config of YEAR_CONFIGS) {
    generateSeed(config, geoMap);
  }
}

function generateSeed(config: YearConfig, geoMap: Record<number, GeoEntry>) {
  const { year, electionId, constPrefix, electionName } = config;

  const jsonPath = path.resolve(__dirname, `../../database/data/as_vs_${year}.json`);
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const results: JsonResult[] = jsonData.results;
  const hasRunnerUp = results[0]?.runner_up != null;
  const hasVotes = hasRunnerUp && results[0]?.winner?.votes != null;

  console.log(`--- ${electionName} (${results.length} seats, runner_up=${hasRunnerUp}, votes=${hasVotes}) ---`);

  const lines: string[] = [];
  lines.push(`-- ${electionName} Election Data`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_as_vs_${year}.sql`);
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
  lines.push(`-- Candidates`);
  const candidateInserts: string[] = [];
  const resultInserts: string[] = [];
  let totalCandidates = 0;

  for (const r of results) {
    const geo = geoMap[r.const_no];
    if (!geo) continue;
    const constId = makeConstId(constPrefix, r.const_no, geo.name);
    const margin = r.margin;

    if (hasRunnerUp && r.runner_up) {
      // Winner + runner-up data
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
        runnerUpVotes = 50000;
        winnerVotes = runnerUpVotes + margin;
      }

      const winCandId = randomUUID();
      const winnerName = r.winner.name || `${winnerPartyId} Candidate`;
      candidateInserts.push(
        `  ('${winCandId}', NULL, '${electionId}', '${esc(constId)}', '${esc(winnerPartyId)}', '${esc(winnerName)}', FALSE, '{}')`
      );
      resultInserts.push(
        `  ('${randomUUID()}', '${winCandId}', '${esc(constId)}', ${winnerVotes}, 'WON', ${margin}, 0, '${electionId}')`
      );
      totalCandidates++;

      const ruCandId = randomUUID();
      const ruName = r.runner_up.name || `${runnerUpPartyId} Candidate`;
      candidateInserts.push(
        `  ('${ruCandId}', NULL, '${electionId}', '${esc(constId)}', '${esc(runnerUpPartyId)}', '${esc(ruName)}', FALSE, '{}')`
      );
      resultInserts.push(
        `  ('${randomUUID()}', '${ruCandId}', '${esc(constId)}', ${runnerUpVotes}, 'LOST', ${margin}, 0, '${electionId}')`
      );
      totalCandidates++;
    } else {
      // Winner-only data (2021 format: winner party + margin, no names)
      const winnerPartyId = PARTY_MAP[r.winner.party] || 'IND';
      if (!PARTY_MAP[r.winner.party]) {
        console.warn(`  WARNING: Unknown party '${r.winner.party}' in const ${r.const_no}`);
      }

      const runnerUpVotes = 50000;
      const winnerVotes = runnerUpVotes + margin;

      const winCandId = randomUUID();
      const winnerName = r.winner.name || `${winnerPartyId} Candidate`;
      candidateInserts.push(
        `  ('${winCandId}', NULL, '${electionId}', '${esc(constId)}', '${esc(winnerPartyId)}', '${esc(winnerName)}', FALSE, '{}')`
      );
      resultInserts.push(
        `  ('${randomUUID()}', '${winCandId}', '${esc(constId)}', ${winnerVotes}, 'WON', ${margin}, 0, '${electionId}')`
      );
      totalCandidates++;

      // Synthetic runner-up (unknown party)
      const ruCandId = randomUUID();
      candidateInserts.push(
        `  ('${ruCandId}', NULL, '${electionId}', '${esc(constId)}', 'IND', 'Runner-up', FALSE, '{}')`
      );
      resultInserts.push(
        `  ('${randomUUID()}', '${ruCandId}', '${esc(constId)}', ${runnerUpVotes}, 'LOST', ${margin}, 0, '${electionId}')`
      );
      totalCandidates++;
    }
  }

  lines.push('INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent, metadata) VALUES');
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

  const outPath = path.resolve(__dirname, `../../database/seed_as_vs_${year}.sql`);
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`  Wrote ${outPath}`);
  console.log(`  ${results.length} constituencies, ${totalCandidates} candidates\n`);
}

main();
