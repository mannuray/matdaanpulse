/**
 * Write database/seed_as_2026_districts_regions.sql from scraper/data/as/districts-2026.json (seat → district code) and
 * the district → region grouping of seed_as_districts_regions.sql (its header comment, read here).
 * Usage: npx ts-node src/bihar/regions-2026-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { electionOf } from './elections';
import { emitRegions2026 } from './regions-2026';

const DB = path.resolve(__dirname, '../../../database');
const old = fs.readFileSync(path.join(DB, 'seed_as_districts_regions.sql'), 'utf8');
const districtCode = new Map([...old.matchAll(/VALUES \(4, '([^']+)', '(AS_[A-Z]+)'\) ON CONFLICT \(code\)/g)].map(m => [m[1].replace(/\W/g, '').toUpperCase(), m[2]]));
const regionCode = new Map([...old.matchAll(/INSERT INTO regions \(state_id, name, code\) VALUES \(4, '([^']+)', '(AS_[A-Z]+)'\)/g)].map(m => [m[1], m[2]]));
// Header lines "-- <Region>: District, District, …" (S.Salmara is South Salmara-Mankachar, Kamrup Metro is Kamrup Metropolitan).
const alias: Record<string, string> = { SSALMARA: 'SOUTHSALMARAMANKACHAR', KAMRUPMETRO: 'KAMRUPMETROPOLITAN' };
const districtRegion: Record<string, string> = { AS_WESTKARBIANGLONG: 'AS_HILLS' };
for (const m of old.matchAll(/^-- ([A-Za-z -]+): ([A-Za-z ,.-]+)$/gm)) {
  const region = regionCode.get(m[1].trim());
  if (!region) continue;
  for (const d of m[2].split(',')) {
    const k = d.replace(/\W/g, '').toUpperCase();
    const code = districtCode.get(alias[k] ?? k);
    if (!code) throw new Error(`header district "${d.trim()}" has no code`);
    districtRegion[code] = region;
  }
}
const file = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/as/districts-2026.json'), 'utf8')) as { seats: Record<string, string> };
const rows = Object.entries(file.seats).map(([no, district]) => ({ constNo: Number(no), district })).sort((a, b) => a.constNo - b.constNo);
const sql = emitRegions2026(rows, districtRegion, electionOf('AS', 2026).electionId)
  .replace('\n\n', "\n\nINSERT INTO districts (state_id, name, code) VALUES (4, 'West Karbi Anglong', 'AS_WESTKARBIANGLONG') ON CONFLICT (code) DO NOTHING;\n\n");
fs.writeFileSync(path.join(DB, 'seed_as_2026_districts_regions.sql'), sql);
console.log(`Wrote seed_as_2026_districts_regions.sql (${rows.length} seats, ${new Set(rows.map(r => districtRegion[r.district])).size} regions)`);
