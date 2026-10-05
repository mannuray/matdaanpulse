/**
 * Write database/seed_<slug>_districts_regions.sql for the Phase 3A states from their sourced
 * scraper/data/<slug>/districts.json (districts, regions, seat → district), scoped to the state's 2008-delimitation VS elections.
 * Usage: npx ts-node src/bihar/regions-cli.ts GA MN UK PB UP
 */
import * as fs from 'fs';
import * as path from 'path';
import { STATES, StateCode, electionsOf } from './elections';
import { emitStateRegions } from './regions';

const DB = path.resolve(__dirname, '../../../database');
for (const code of process.argv.slice(2) as StateCode[]) {
  const st = STATES[code];
  if (!st) throw new Error(`unknown state ${code}`);
  const file = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../data/${st.slug}/districts.json`), 'utf8')) as {
    districts: { code: string; name: string }[]; regions: { code: string; name: string; districts: string[] }[]; seats: Record<string, string>;
  };
  const electionIds = electionsOf(code).filter(e => e.newElection?.delimitation === '2008').map(e => e.electionId);
  const seats = Object.fromEntries(Object.entries(file.seats).map(([no, d]) => [Number(no), d]));
  const sql = emitStateRegions({ stateId: st.stateId, stateName: st.name, seatCount: st.seats, districts: file.districts, regions: file.regions, seats, electionIds });
  const out = `seed_${st.slug}_districts_regions.sql`;
  fs.writeFileSync(path.join(DB, out), sql.replace('<slug>', st.slug));
  console.log(`Wrote ${out} (${st.seats} seats, ${file.districts.length} districts, ${file.regions.length} regions, ${electionIds.length} elections)`);
}
