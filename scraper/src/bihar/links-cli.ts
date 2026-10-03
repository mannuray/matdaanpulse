/** Build seed_bihar_person_links_v2.sql + links-review.json. Usage: npx ts-node src/bihar/links-cli.ts */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
import { DB_DIR, loadSeeded } from './seeded';
import { emitLinksSeed, groupCandidacies, type Candidacy } from './links';
import type { Year } from './types';

const all: Candidacy[] = [];
for (const y of [2010, 2015, 2020, 2025] as Year[]) {
  const s = loadSeeded(y);
  for (const seat of s.json.seats) for (const c of seat.candidates) {
    all.push({ candidateId: s.idOf(seat.constNo, c), year: y, constNo: seat.constNo, name: c.name, partyId: c.partyId });
  }
}
const groups = groupCandidacies(all);
fs.writeFileSync(path.join(DB_DIR, 'seed_bihar_person_links_v2.sql'), emitLinksSeed(groups) + '\n');
fs.writeFileSync(path.join(DATA_DIR, 'links-review.json'), JSON.stringify(groups.filter(g => g.confidence === 'review'), null, 1) + '\n');
const count = (c: string) => groups.filter(g => g.confidence === c).length;
console.log(`groups: ${count('high')} high, ${count('medium')} medium, ${count('review')} review (not linked)`);
