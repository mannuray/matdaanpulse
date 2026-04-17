/**
 * Generate West Bengal Vidhan Sabha seed SQL files for 2011, 2016, 2021.
 *
 * Reads JSON data from database/data/wb_vs_{year}.json and GeoJSON from
 * frontend/public/geo/wb_ac.geojson for canonical names + categories.
 *
 * Usage: npx ts-node src/generate-wb-vs-seeds.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATE_ID = 36; // West Bengal

interface YearConfig {
  year: number;
  electionId: string;
  constPrefix: string; // e.g. WB_VS11
  electionName: string;
  manifest: object;
}

const YEAR_CONFIGS: YearConfig[] = [
  {
    year: 2011,
    electionId: 'd4e5f6a7-b8c9-0123-def0-345678901011',
    constPrefix: 'WB_VS11',
    electionName: 'West Bengal Vidhan Sabha 2011',
    manifest: {
      alliances: [
        {
          id: 'TMCALL',
          name: 'TMC + Congress',
          color: '#00CC44',
          parties: ['TMC', 'INC'],
        },
        {
          id: 'LF',
          name: 'Left Front',
          color: '#CC0000',
          parties: ['CPIM', 'CPI', 'AIFB', 'RSP', 'DSPP', 'SP'],
        },
      ],
      leaders: [
        { name: 'Mamata Banerjee', party_id: 'TMC', const_id: 'WB_VS11_159_BHABANIPUR' },
        { name: 'Buddhadeb Bhattacharjee', party_id: 'CPIM', const_id: 'WB_VS11_150_JADAVPUR' },
      ],
      cabinet: [],
      tracked: ['TMCALL', 'LF', 'GJM', 'BJP'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 148 }],
      geo: {
        map_url: '/geo/wb_ac.geojson',
        center: [87.5, 23.0],
        zoom: 7,
      },
      delimitation_era: '2008',
    },
  },
  {
    year: 2016,
    electionId: 'd4e5f6a7-b8c9-0123-def0-345678901016',
    constPrefix: 'WB_VS16',
    electionName: 'West Bengal Vidhan Sabha 2016',
    manifest: {
      alliances: [
        {
          id: 'TMC',
          name: 'Trinamool Congress',
          color: '#00CC44',
          parties: ['TMC'],
        },
        {
          id: 'LFINC',
          name: 'Left + Congress',
          color: '#CC0000',
          parties: ['CPIM', 'INC', 'RSP', 'AIFB', 'CPI'],
        },
        {
          id: 'NDA',
          name: 'NDA',
          color: '#FF6B00',
          parties: ['BJP'],
        },
      ],
      leaders: [
        { name: 'Mamata Banerjee', party_id: 'TMC', const_id: 'WB_VS16_159_BHABANIPUR' },
        { name: 'Surjya Kanta Mishra', party_id: 'CPIM', const_id: 'WB_VS16_225_NARAYANGARH' },
      ],
      cabinet: [],
      tracked: ['TMC', 'LFINC', 'NDA', 'GJM'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 148 }],
      compare_with: ['d4e5f6a7-b8c9-0123-def0-345678901011'],
      geo: {
        map_url: '/geo/wb_ac.geojson',
        center: [87.5, 23.0],
        zoom: 7,
      },
      delimitation_era: '2008',
    },
  },
  {
    year: 2021,
    electionId: 'd4e5f6a7-b8c9-0123-def0-345678901021',
    constPrefix: 'WB_VS21',
    electionName: 'West Bengal Vidhan Sabha 2021',
    manifest: {
      alliances: [
        {
          id: 'TMC',
          name: 'Trinamool Congress',
          color: '#00CC44',
          parties: ['TMC'],
        },
        {
          id: 'NDA',
          name: 'NDA',
          color: '#FF6B00',
          parties: ['BJP'],
        },
        {
          id: 'SM',
          name: 'Sanjukta Morcha',
          color: '#CC0000',
          parties: ['CPIM', 'INC', 'RSMP'],
        },
      ],
      leaders: [
        { name: 'Mamata Banerjee', party_id: 'TMC', const_id: 'WB_VS21_210_NANDIGRAM' },
        { name: 'Suvendu Adhikari', party_id: 'BJP', const_id: 'WB_VS21_210_NANDIGRAM' },
      ],
      cabinet: [],
      tracked: ['TMC', 'NDA', 'SM'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 148 }],
      compare_with: ['d4e5f6a7-b8c9-0123-def0-345678901016'],
      history: [
        'd4e5f6a7-b8c9-0123-def0-345678901011',
        'd4e5f6a7-b8c9-0123-def0-345678901016',
      ],
      history_years: [2011, 2016],
      geo: {
        map_url: '/geo/wb_ac.geojson',
        center: [87.5, 23.0],
        zoom: 7,
      },
      vote_splits: [
        { spoiler: 'CPIM', hurts: 'NDA', label: 'Left split' },
        { spoiler: 'INC', hurts: 'NDA', label: 'Congress split' },
      ],
      delimitation_era: '2008',
    },
  },
];

/** Map JSON party abbreviation → DB party ID */
const PARTY_MAP: Record<string, string> = {
  AITC: 'TMC',
  BJP: 'BJP',
  INC: 'INC',
  CPM: 'CPIM',
  CPI: 'CPI',
  AIFB: 'AIFB',
  RSP: 'RSP',
  RJD: 'RJD',
  NCP: 'NCP',
  'JD(U)': 'JDU',
  IND: 'IND',
  SP: 'SP',
  BSP: 'BSP',
  AJSU: 'AP1',
  // New WB parties
  SUCI: 'SUCI',
  GJM: 'GJM',
  GOJAM: 'GJM', // same party, 2011 ECI code
  GNLF: 'GNLF',
  NIC: 'INC', // data error in source, actually INC
  JKP: 'JKP',
  'JKP(N)': 'JKPN',
  'DCP(PC)': 'DSPP', // same party as DSP(P), different code
  'DSP(P)': 'DSPP',
  RSMP: 'RSMP',
  'RCPI(R)': 'RCPIR',
  // PDF full-data party codes (2021 ECI detailed results)
  'CPI(M)': 'CPIM',
  'SUCI(C)': 'SUCI', // same as SUCI
  'CPI(ML)(L)': 'CPIML',
  AMB: 'AMB', // Amra Bangalee
  KPPU: 'KPPU', // Kamatapur People's Party (United)
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
  console.log('=== West Bengal Vidhan Sabha Seed Generator ===\n');

  // Load GeoJSON
  const geoPath = path.resolve(__dirname, '../../frontend/public/geo/wb_ac.geojson');
  const geoData = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
  const geoMap: Record<number, GeoEntry> = {};
  for (const feat of geoData.features) {
    const p = feat.properties;
    geoMap[p.ac_no] = { name: p.ac_name, category: p.ac_category || 'GEN' };
  }

  for (const config of YEAR_CONFIGS) {
    generateSeed(config, geoMap);
  }
}

function generateSeed(config: YearConfig, geoMap: Record<number, GeoEntry>) {
  const { year, electionId, constPrefix, electionName } = config;

  // Load JSON data
  const jsonPath = path.resolve(__dirname, `../../database/data/wb_vs_${year}.json`);
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const results: JsonResult[] = jsonData.results;
  const hasVotes = results[0]?.winner?.votes != null;

  console.log(`--- ${electionName} (${results.length} seats, votes=${hasVotes}) ---`);

  const lines: string[] = [];
  lines.push(`-- ${electionName} Election Data`);
  lines.push(`-- Source: ECI / elections.in (winner + runner-up per constituency)`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_wb_vs_${year}.sql`);
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
  lines.push(constLines.join(',\n') + ';');
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
      // Full candidate data: emit all candidates
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
          `  ('${candId}', NULL, '${electionId}', '${esc(constId)}', '${esc(partyId)}', '${esc(cand.name)}', FALSE, '{}')`
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
        runnerUpVotes = 50000;
        winnerVotes = runnerUpVotes + margin;
      }

      const winCandId = randomUUID();
      candidateInserts.push(
        `  ('${winCandId}', NULL, '${electionId}', '${esc(constId)}', '${esc(winnerPartyId)}', '${esc(r.winner.name)}', FALSE, '{}')`
      );
      resultInserts.push(
        `  ('${randomUUID()}', '${winCandId}', '${esc(constId)}', ${winnerVotes}, 'WON', ${margin}, 0, '${electionId}')`
      );
      totalCandidates++;

      const ruCandId = randomUUID();
      candidateInserts.push(
        `  ('${ruCandId}', NULL, '${electionId}', '${esc(constId)}', '${esc(runnerUpPartyId)}', '${esc(r.runner_up.name)}', FALSE, '{}')`
      );
      resultInserts.push(
        `  ('${randomUUID()}', '${ruCandId}', '${esc(constId)}', ${runnerUpVotes}, 'LOST', ${margin}, 0, '${electionId}')`
      );
      totalCandidates++;
    }
  }

  lines.push('INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent, metadata) VALUES');
  lines.push(candidateInserts.join(',\n') + ';');
  lines.push('');

  lines.push('-- Results');
  lines.push('INSERT INTO results (id, candidate_id, const_id, votes, status, margin, round_no, election_id) VALUES');
  lines.push(resultInserts.join(',\n') + ';');
  lines.push('');

  // Manifest
  lines.push('-- Manifest');
  lines.push(`UPDATE elections SET manifest_url = '${esc(JSON.stringify(config.manifest))}' WHERE id = '${electionId}';`);
  lines.push('');

  // Write
  const outPath = path.resolve(__dirname, `../../database/seed_wb_vs_${year}.sql`);
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`  Wrote ${outPath}`);
  console.log(`  ${results.length} constituencies, ${totalCandidates} candidates\n`);
}

main();
