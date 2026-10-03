/** Build seed_bihar_person_links_v2.sql + links-review.json. Usage: npx ts-node src/bihar/links-cli.ts */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
import { readExistingSeed } from './existing-seed';
import { candidateIds, type Plan } from './emit';
import { emitLinksSeed, groupCandidacies, type Candidacy } from './links';
import type { ElectionJson, Year } from './types';

const DB_DIR = path.resolve(__dirname, '../../../database');
const all: Candidacy[] = [];
for (const y of [2010, 2015, 2020, 2025] as Year[]) {
  const json: ElectionJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `vs-${y}.json`), 'utf8'));
  const seed = readExistingSeed(fs.readFileSync(path.join(DB_DIR, `seed_bihar_vs_${y}.sql`), 'utf8'));
  // The committed year seed already holds every candidate: each one matches itself, so candidateIds gives the seeded ids.
  const byConst = new Map(seed.constituencies.map(k => [k.constNo, k.id]));
  const plan: Plan = { json, seed, matches: json.seats.map(s => ({ constId: byConst.get(s.constNo)!, matched: [], unmatchedOld: [], deleted: [] })) };
  const seededIds = new Map(seed.candidates.map(c => [`${c.constId}|${c.name}|${c.partyId}`, c.id]));
  for (const s of json.seats) for (const c of s.candidates) {
    const id = seededIds.get(`${byConst.get(s.constNo)}|${c.name}|${c.partyId}`) ?? candidateIds(plan).get(`${s.constNo}:${c.serial}`)!.candidateId;
    all.push({ candidateId: id, year: y, constNo: s.constNo, name: c.name, partyId: c.partyId });
  }
}
const groups = groupCandidacies(all);
fs.writeFileSync(path.join(DB_DIR, 'seed_bihar_person_links_v2.sql'), emitLinksSeed(groups) + '\n');
fs.writeFileSync(path.join(DATA_DIR, 'links-review.json'), JSON.stringify(groups.filter(g => g.confidence === 'review'), null, 1) + '\n');
const count = (c: string) => groups.filter(g => g.confidence === c).length;
console.log(`groups: ${count('high')} high, ${count('medium')} medium, ${count('review')} review (not linked)`);
