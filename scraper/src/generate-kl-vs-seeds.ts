/**
 * Generate Kerala Vidhan Sabha seed SQL files for 2011, 2016, 2021.
 *
 * Usage: npx ts-node src/generate-kl-vs-seeds.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const STATE_ID = 16; // Kerala

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
    electionId: 'a7b8c9d0-e1f2-3456-0123-678901232011',
    constPrefix: 'KL_VS11',
    electionName: 'Kerala Vidhan Sabha 2011',
    manifest: {
      alliances: [
        {
          id: 'UDF',
          name: 'UDF',
          color: '#19AAED',
          parties: ['INC', 'MUL', 'KECM', 'KECJ', 'KECB', 'JDS', 'RSP', 'SJD', 'NCP'],
        },
        {
          id: 'LDF',
          name: 'LDF',
          color: '#CC0000',
          parties: ['CPIM', 'CPI', 'INL', 'KRSP', 'JPSS', 'CMPKSC'],
        },
        {
          id: 'NDA',
          name: 'NDA',
          color: '#FF6B00',
          parties: ['BJP'],
        },
      ],
      leaders: [
        { name: 'Oommen Chandy', party_id: 'INC', const_id: 'KL_VS11_112_PUTHUPPALLY' },
        { name: 'V.S. Achuthanandan', party_id: 'CPIM', const_id: 'KL_VS11_52_MALAMPUZHA' },
      ],
      cabinet: [],
      tracked: ['UDF', 'LDF', 'NDA'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 71 }],
      geo: {
        map_url: '/geo/kl_ac_2008.geojson',
        center: [76.3, 10.5],
        zoom: 10,
      },
      delimitation_era: '2008',
    },
  },
  {
    year: 2016,
    electionId: 'a7b8c9d0-e1f2-3456-0123-678901232016',
    constPrefix: 'KL_VS16',
    electionName: 'Kerala Vidhan Sabha 2016',
    manifest: {
      alliances: [
        {
          id: 'LDF',
          name: 'LDF',
          color: '#CC0000',
          parties: ['CPIM', 'CPI', 'INL', 'KECB', 'JDS', 'NCP', 'CMPKSC', 'NSC'],
        },
        {
          id: 'UDF',
          name: 'UDF',
          color: '#19AAED',
          parties: ['INC', 'IUML', 'KECM', 'KECJ', 'RSP', 'KECST', 'INCS'],
        },
        {
          id: 'NDA',
          name: 'NDA',
          color: '#FF6B00',
          parties: ['BJP'],
        },
      ],
      leaders: [
        { name: 'Pinarayi Vijayan', party_id: 'CPIM', const_id: 'KL_VS16_4_DHARMADOM' },
        { name: 'Oommen Chandy', party_id: 'INC', const_id: 'KL_VS16_112_PUTHUPPALLY' },
      ],
      cabinet: [],
      tracked: ['LDF', 'UDF', 'NDA'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 71 }],
      compare_with: ['a7b8c9d0-e1f2-3456-0123-678901232011'],
      geo: {
        map_url: '/geo/kl_ac_2008.geojson',
        center: [76.3, 10.5],
        zoom: 10,
      },
      delimitation_era: '2008',
    },
  },
  {
    year: 2021,
    electionId: 'a7b8c9d0-e1f2-3456-0123-678901232021',
    constPrefix: 'KL_VS21',
    electionName: 'Kerala Vidhan Sabha 2021',
    manifest: {
      alliances: [
        {
          id: 'LDF',
          name: 'LDF',
          color: '#CC0000',
          parties: ['CPIM', 'CPI', 'INL', 'KECM', 'KECB', 'JDS', 'NCP', 'LJD', 'KEC', 'NSC', 'RMPI', 'JKC'],
        },
        {
          id: 'UDF',
          name: 'UDF',
          color: '#19AAED',
          parties: ['INC', 'IUML', 'KECJ', 'RSP', 'INCS'],
        },
        {
          id: 'NDA',
          name: 'NDA',
          color: '#FF6B00',
          parties: ['BJP'],
        },
      ],
      leaders: [
        { name: 'Pinarayi Vijayan', party_id: 'CPIM', const_id: 'KL_VS21_4_DHARMADOM' },
        { name: 'Ramesh Chennithala', party_id: 'INC', const_id: 'KL_VS21_109_HARIPAD' },
      ],
      cabinet: [],
      tracked: ['LDF', 'UDF', 'NDA'],
      vip_seats: {},
      milestones: [{ label: 'Majority', value: 71 }],
      compare_with: ['a7b8c9d0-e1f2-3456-0123-678901232016'],
      history: [
        'a7b8c9d0-e1f2-3456-0123-678901232011',
        'a7b8c9d0-e1f2-3456-0123-678901232016',
      ],
      history_years: [2011, 2016],
      geo: {
        map_url: '/geo/kl_ac_2008.geojson',
        center: [76.3, 10.5],
        zoom: 10,
      },
      delimitation_era: '2008',
    },
  },
];

/** Map JSON party abbreviation → DB party ID */
const PARTY_MAP: Record<string, string> = {
  CPM: 'CPIM',
  CPI: 'CPI',
  INC: 'INC',
  BJP: 'BJP',
  NCP: 'NCP',
  RSP: 'RSP',
  IND: 'IND',
  INL: 'INL',
  BSP: 'BSP',
  // Kerala-specific
  MUL: 'MUL',
  IUML: 'IUML',
  'KC(AMG)': 'KECAMG', // Kerala Congress (Mani) — A.K. Antony Mani Group (distinct faction)
  'KC(M)': 'KECM',
  'KEC(M)': 'KECM',
  'KC(J)': 'KECJ',
  'KEC(J)': 'KECJ',
  'KC(B)': 'KECB',
  'KEC(B)': 'KECB',
  'KEC(ST)': 'KECST',
  KEC: 'KEC',
  'JD(S)': 'JDS',
  'JD(U)': 'JDU',
  SJD: 'SJD',
  JPSS: 'JPSS',
  KRSP: 'KRSP',
  CMPKSC: 'CMPKSC',
  NSC: 'NSC',
  LJD: 'LJD',
  RMPI: 'RMPI',
  JKC: 'JKC',
  'INC(S)': 'INCS',
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

interface JsonCandidate { name?: string; party: string; votes?: number; }
interface JsonResult { const_no: number; const_name: string; winner: JsonCandidate; runner_up?: JsonCandidate; margin: number; }
interface GeoEntry { name: string; category: string; }

function main() {
  console.log('=== Kerala Vidhan Sabha Seed Generator ===\n');

  const geoPath = path.resolve(__dirname, '../../frontend/public/geo/kl_ac_2008.geojson');
  const geoData = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
  const geoMap: Record<number, GeoEntry> = {};
  for (const feat of geoData.features) {
    const p = feat.properties;
    if (geoMap[p.ac_no]) continue;
    geoMap[p.ac_no] = { name: p.ac_name, category: p.ac_category || 'GEN' };
  }

  for (const config of YEAR_CONFIGS) {
    generateSeed(config, geoMap);
  }
}

function generateSeed(config: YearConfig, geoMap: Record<number, GeoEntry>) {
  const { year, electionId, constPrefix, electionName } = config;

  const jsonPath = path.resolve(__dirname, `../../database/data/kl_vs_${year}.json`);
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const results: JsonResult[] = jsonData.results;
  const hasRunnerUp = results[0]?.runner_up != null;
  const hasVotes = hasRunnerUp && results[0]?.winner?.votes != null;

  console.log(`--- ${electionName} (${results.length} seats, runner_up=${hasRunnerUp}, votes=${hasVotes}) ---`);

  const lines: string[] = [];
  lines.push(`-- ${electionName} Election Data`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_kl_vs_${year}.sql`);
  lines.push('');

  lines.push('-- Election');
  lines.push(`INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date) VALUES`);
  lines.push(`  ('${electionId}', '${esc(electionName)}', 'VS', ${STATE_ID}, ${year}, 'Finalized', NULL)`);
  lines.push(`ON CONFLICT (id) DO NOTHING;`);
  lines.push('');

  lines.push(`-- Constituencies (${results.length})`);
  lines.push('INSERT INTO constituencies (id, election_id, district_id, state_id, name, const_no, type, voter_turnout, phase, total_electors) VALUES');
  const constLines: string[] = [];
  for (const r of results) {
    const geo = geoMap[r.const_no];
    if (!geo) { console.warn(`  WARNING: No GeoJSON for const_no ${r.const_no} (${r.const_name})`); continue; }
    const constId = makeConstId(constPrefix, r.const_no, geo.name);
    const displayName = geo.name.split(' ').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
    constLines.push(`  ('${esc(constId)}', '${electionId}', NULL, ${STATE_ID}, '${esc(displayName)}', ${r.const_no}, '${geo.category}', NULL, NULL, NULL)`);
  }
  lines.push(constLines.join(',\n') + '\nON CONFLICT DO NOTHING;');
  lines.push('');

  lines.push(`-- Candidates`);
  const candidateInserts: string[] = [];
  const resultInserts: string[] = [];
  let totalCandidates = 0;

  for (const r of results) {
    const geo = geoMap[r.const_no];
    if (!geo) continue;
    const constId = makeConstId(constPrefix, r.const_no, geo.name);
    const margin = r.margin;

    const winnerPartyId = PARTY_MAP[r.winner.party] || 'IND';
    if (!PARTY_MAP[r.winner.party]) console.warn(`  WARNING: Unknown party '${r.winner.party}' const ${r.const_no}`);

    let winnerVotes: number, runnerUpVotes: number;
    if (hasVotes && r.runner_up) {
      winnerVotes = r.winner.votes!;
      runnerUpVotes = r.runner_up.votes!;
    } else {
      runnerUpVotes = 50000;
      winnerVotes = runnerUpVotes + margin;
    }

    const winCandId = randomUUID();
    const winnerName = r.winner.name || `${winnerPartyId} Candidate`;
    candidateInserts.push(`  ('${winCandId}', NULL, '${electionId}', '${esc(constId)}', '${esc(winnerPartyId)}', '${esc(winnerName)}', FALSE)`);
    resultInserts.push(`  ('${randomUUID()}', '${winCandId}', '${esc(constId)}', ${winnerVotes}, 'WON', ${margin}, 0, '${electionId}')`);
    totalCandidates++;

    if (r.runner_up) {
      let ruPartyId = PARTY_MAP[r.runner_up.party] || 'IND';
      if (!PARTY_MAP[r.runner_up.party]) console.warn(`  WARNING: Unknown party '${r.runner_up.party}' const ${r.const_no}`);
      // Avoid duplicate (election_id, const_id, party_id) — e.g. two IND candidates
      if (ruPartyId === winnerPartyId) ruPartyId = ruPartyId + '2';
      const ruCandId = randomUUID();
      const ruName = r.runner_up.name || `${ruPartyId} Candidate`;
      candidateInserts.push(`  ('${ruCandId}', NULL, '${electionId}', '${esc(constId)}', '${esc(ruPartyId)}', '${esc(ruName)}', FALSE)`);
      resultInserts.push(`  ('${randomUUID()}', '${ruCandId}', '${esc(constId)}', ${runnerUpVotes}, 'LOST', ${margin}, 0, '${electionId}')`);
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
  lines.push('-- Manifest');
  lines.push(`UPDATE elections SET manifest_url = '${esc(JSON.stringify(config.manifest))}' WHERE id = '${electionId}';`);
  lines.push('');

  const outPath = path.resolve(__dirname, `../../database/seed_kl_vs_${year}.sql`);
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`  Wrote ${outPath}`);
  console.log(`  ${results.length} constituencies, ${totalCandidates} candidates\n`);
}

main();
