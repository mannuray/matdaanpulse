/**
 * Parse one or more Bihar years from the raw ECI files into scraper/data/bihar/vs-<year>.json.
 * Fails (exit 1, nothing written for that year) on any cross-check or validation error.
 * Usage: npx ts-node src/bihar/parse-cli.ts 2020 [2010 2015 2025]
 */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR, loadRaw } from './load';
import { YEARS } from './years';
import { normalize } from './normalize';
import { crossCheck, validateElection, type CrossCheckException } from './crosscheck';
import type { PartyMap, Year } from './types';

const readJson = <T>(name: string, fallback: T): T => {
  const f = path.join(DATA_DIR, name);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) as T : fallback;
};

let failed = false;
for (const y of process.argv.slice(2).map(Number) as Year[]) {
  const cfg = YEARS[y];
  if (!cfg) { console.error(`unknown year ${y}`); failed = true; continue; }
  const raw = loadRaw(y);
  const xErrs = crossCheck(raw, readJson<CrossCheckException[]>('crosscheck-exceptions.json', []));
  const { json, errors } = normalize(raw, cfg, readJson<PartyMap>('party-map.json', {}), new Date().toISOString().slice(0, 10));
  const all = [...xErrs, ...errors, ...(errors.length ? [] : validateElection(json))];
  console.log(`Bihar ${y}: ${raw.seats.length} seats, ${raw.seats.reduce((a, s) => a + s.candidates.length, 0)} candidates, ${all.length} problems`);
  for (const e of all) console.error(`  ${e}`);
  if (all.length) { failed = true; continue; }
  const prev = readJson<{ source?: { retrieved?: string } } | null>(`vs-${y}.json`, null);
  if (prev?.source?.retrieved) json.source.retrieved = prev.source.retrieved; // keep the first retrieval date so regeneration is diff-free
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `vs-${y}.json`), JSON.stringify(json, null, 1) + '\n');
}
process.exit(failed ? 1 : 0);
