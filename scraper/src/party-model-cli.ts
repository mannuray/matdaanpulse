/**
 * Write database/seed_party_lineage.sql and database/seed_party_units_v1.sql from scraper/data/parties/lineage.json and
 * scraper/data/parties/units-*.json. Party ids are checked against the local DB (DATABASE_URL); leaders are linked to
 * candidates from the committed election data. Usage: npx ts-node src/party-model-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { electionsOf, STATES, type StateCode } from './bihar/elections';
import { loadSeeded } from './bihar/seeded';
import { emitLineageSeed, emitUnitsSeed, pickCandidate, unitsSeedOf, type LineageRow, type UnitRow } from './party-model';
import type { Year } from './bihar/types';

const DATA = path.resolve(__dirname, '../data/parties');
const DB = path.resolve(__dirname, '../../database');

async function main() {
  const db = new Client({ connectionString: (process.env.DATABASE_URL ?? 'postgresql://admin:password123@localhost:3083/election_tracker').split('?')[0] });
  await db.connect();
  const parties = new Set((await db.query<{ id: string }>('SELECT id FROM parties')).rows.map(r => r.id));
  const states = new Map((await db.query<{ code: string; id: number }>('SELECT code, id FROM states')).rows.map(r => [r.code, r.id]));
  await db.end();

  const lineage: LineageRow[] = JSON.parse(fs.readFileSync(path.join(DATA, 'lineage.json'), 'utf8'));
  fs.writeFileSync(path.join(DB, 'seed_party_lineage.sql'), emitLineageSeed(lineage, parties, states));

  // Each units file belongs to one run-once seed (unitsSeedOf); shipped seeds are frozen, a new file needs a new version.
  const files = fs.readdirSync(DATA).filter(f => /^units-\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(6), 10) - parseInt(b.slice(6), 10));
  const bySeed = new Map<string, UnitRow[]>();
  for (const f of files) bySeed.set(unitsSeedOf(f), [...(bySeed.get(unitsSeedOf(f)) ?? []), ...JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')) as UnitRow[]]);
  const cands = new Map<string, { id: string; name: string; year: number; party: string }[]>();
  const candidatesOf = (code: string) => {
    if (!cands.has(code)) {
      const st = code as StateCode;
      const list = STATES[st] ? electionsOf(st).flatMap(e => {
        const s = loadSeeded(st, e.year as Year);
        return s.json.seats.flatMap(seat => seat.candidates.filter(c => c.partyId !== 'NOTA').map(c => ({ id: s.idOf(seat.constNo, c), name: c.name, year: e.year, party: c.partyId })));
      }) : [];
      cands.set(code, list);
    }
    return cands.get(code)!;
  };
  // A leader may have contested for a party their unit's party came from (or broke away from): any direct lineage edge.
  const related = (a: string) => (b: string) => lineage.some(l => (l.party_id === a && l.predecessor_id === b) || (l.party_id === b && l.predecessor_id === a));
  let linked = 0, roles = 0;
  const candidateFor = (name: string, code: string, party: string, ballot?: string) => {
    roles++; const c = pickCandidate(candidatesOf(code), name, party, related(party), ballot); if (c) linked++; return c;
  };
  for (const [seed, units] of bySeed) fs.writeFileSync(path.join(DB, `${seed}.sql`), emitUnitsSeed(units, parties, states, candidateFor, seed));
  console.log(`lineage: ${lineage.length} events · units: ${[...bySeed].map(([k, u]) => `${k.replace('seed_party_units_', '')} ${u.length}`).join(', ')} · roles: ${roles} (${linked} linked to a person)`);
}
main().catch(e => { console.error(e); process.exit(1); });
