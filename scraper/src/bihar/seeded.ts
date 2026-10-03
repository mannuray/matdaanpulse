/** A year's normalised JSON with the candidate ids and constituency names of its committed seed. */
import * as fs from 'fs';
import * as path from 'path';
import { dataDir } from './load';
import { STATES, type StateCode } from './elections';
import { readExistingSeed, type ExistingSeed } from './existing-seed';
import { candidateIds, type Plan } from './emit';
import type { CandidateJson, ElectionJson, Year } from './types';

export const DB_DIR = path.resolve(__dirname, '../../../database');

export interface Seeded {
  json: ElectionJson;
  seed: ExistingSeed;
  /** The constituency row (id, name) of a seat. */
  seat(constNo: number): { id: string; name: string };
  /** The seeded candidate id of a JSON candidate. */
  idOf(constNo: number, c: CandidateJson): string;
}

export function loadSeeded(s: StateCode, year: Year): Seeded {
  const json: ElectionJson = JSON.parse(fs.readFileSync(path.join(dataDir(s), `vs-${year}.json`), 'utf8'));
  const seed = readExistingSeed(fs.readFileSync(path.join(DB_DIR, STATES[s].yearSeed(year)), 'utf8'));
  const byNo = new Map(seed.constituencies.map(k => [k.constNo, k]));
  // The committed year seed holds every candidate: old rows keep their ids, the rest have stable ids (candidateIds).
  const plan: Plan = { json, seed, matches: json.seats.map(s => ({ constId: byNo.get(s.constNo)!.id, matched: [], unmatchedOld: [], deleted: [] })) };
  const stable = candidateIds(plan);
  const seeded = new Map(seed.candidates.map(c => [`${c.constId}|${c.name}|${c.partyId}`, c.id]));
  return {
    json, seed,
    seat: n => { const k = byNo.get(n); if (!k) throw new Error(`${year}: no seat ${n}`); return { id: k.id, name: k.name }; },
    idOf: (n, c) => seeded.get(`${byNo.get(n)!.id}|${c.name}|${c.partyId}`) ?? stable.get(`${n}:${c.serial}`)!.candidateId,
  };
}
