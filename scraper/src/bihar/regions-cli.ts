/**
 * Write database/seed_<slug>_districts_regions.sql for the Phase 3A states from their sourced
 * scraper/data/<slug>/districts.json (districts, regions, seat → district), scoped to the state's 2008-delimitation VS elections;
 * a state with redraws (J&K) has one districts-<era>.json per boundary set instead.
 * Usage: npx ts-node src/bihar/regions-cli.ts GA MN UK PB UP
 */
import * as fs from 'fs';
import * as path from 'path';
import { STATES, StateCode } from './elections';
import { emitStateRegions, regionSets } from './regions';

type DistrictsFile = {
  districts: { code: string; name: string }[]; regions: { code: string; name: string; districts: string[] }[]; seats: Record<string, string>; seatRegions?: Record<string, string>;
};
const DB = path.resolve(__dirname, '../../../database');
for (const code of process.argv.slice(2) as StateCode[]) {
  const st = STATES[code];
  if (!st) throw new Error(`unknown state ${code}`);
  const dir = path.resolve(__dirname, `../../data/${st.slug}`);
  // One block per boundary set (districts.json = 2008; districts-<era>.json for states with redraws, J&K).
  const blocks = regionSets(code, fs.readdirSync(dir)).map(set => {
    const file = JSON.parse(fs.readFileSync(path.join(dir, set.file), 'utf8')) as DistrictsFile;
    const seats = Object.fromEntries(Object.entries(file.seats).map(([no, d]) => [Number(no), d]));
    const seatRegions = file.seatRegions ? Object.fromEntries(Object.entries(file.seatRegions).map(([no, r]) => [Number(no), r])) : undefined;
    console.log(`${st.name} ${set.delimitation}: ${set.seatCount} seats, ${file.districts.length} districts, ${file.regions.length} regions, ${set.electionIds.length} elections`);
    return emitStateRegions({ stateId: st.stateId, stateName: st.name, seatCount: set.seatCount, districts: file.districts, regions: file.regions, seats, seatRegions, electionIds: set.electionIds })
      .replace('<slug>/districts.json', `<slug>/${set.file}`).replace('<slug>', st.slug);
  });
  const out = `seed_${st.slug}_districts_regions.sql`;
  fs.writeFileSync(path.join(DB, out), blocks.join('\n'));
  console.log(`Wrote ${out}`);
}
