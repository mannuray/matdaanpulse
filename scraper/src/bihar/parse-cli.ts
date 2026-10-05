/**
 * Parse one or more years of a state from the raw ECI files into scraper/data/<slug>/vs-<year>.json.
 * Fails (exit 1, nothing written for that year) on any cross-check or validation error.
 * Usage: npx ts-node src/bihar/parse-cli.ts <STATE> 2020 [2010 2015 2025]
 */
import * as fs from 'fs';
import * as path from 'path';
import { PARTY_DIR, dataDir, loadRaw } from './load';
import { STATES, electionOf, parseState } from './elections';
import { normalize } from './normalize';
import { applyOverrides } from './party-map';
import { applyCandidateFixes, duplicatePartySeats, type CandidateFixes } from './candidate-fixes';
import { crossCheck, validateElection, type CrossCheckException } from './crosscheck';
import type { PartyEntry, PartyMap, Year } from './types';

const ST = parseState(process.argv[2]);
const DATA_DIR = dataDir(ST);
const readJson = <T>(name: string, fallback: T, dir = DATA_DIR): T => {
  const f = path.join(dir, name);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) as T : fallback;
};

let failed = false;
for (const y of process.argv.slice(3).map(Number) as Year[]) {
  const cfg = electionOf(ST, y);
  const raw = loadRaw(ST, y);
  const xErrs = crossCheck(raw, readJson<CrossCheckException[]>('crosscheck-exceptions.json', []));
  const { json: normalized, errors } = normalize(raw, cfg, applyOverrides(readJson<PartyMap>('party-map.json', {}, PARTY_DIR), readJson<Record<string, string | PartyEntry>>('party-overrides.json', {})), new Date().toISOString().slice(0, 10));
  const json = applyCandidateFixes(normalized, readJson<Record<string, CandidateFixes>>('candidate-fixes.json', {})[y] ?? {});
  const dups = duplicatePartySeats(json).map(d => `party twice in a seat ${d} (add a sourced candidate-fixes.json entry)`);
  const all = [...xErrs, ...errors, ...dups, ...(errors.length ? [] : validateElection(json, cfg))];
  console.log(`${STATES[ST].name} ${y}: ${raw.seats.length} seats, ${raw.seats.reduce((a, s) => a + s.candidates.length, 0)} candidates, ${all.length} problems`);
  for (const e of all) console.error(`  ${e}`);
  if (all.length) { failed = true; continue; }
  const prev = readJson<{ source?: { retrieved?: string } } | null>(`vs-${y}.json`, null);
  if (prev?.source?.retrieved) json.source.retrieved = prev.source.retrieved; // keep the first retrieval date so regeneration is diff-free
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `vs-${y}.json`), JSON.stringify(json, null, 1) + '\n');
}
process.exit(failed ? 1 : 0);
