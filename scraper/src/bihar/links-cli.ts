/** Build a state's person-links seed + links-review.json. Usage: npx ts-node src/bihar/links-cli.ts <STATE> */
import * as fs from 'fs';
import * as path from 'path';
import { dataDir } from './load';
import { DB_DIR, loadSeeded } from './seeded';
import { emitLinksSeed, groupCandidacies, type Candidacy } from './links';
import { STATES, electionsOf, parseState } from './elections';

const ST = parseState(process.argv[2]);
const all: Candidacy[] = [];
for (const y of electionsOf(ST).map(e => e.year)) {
  const s = loadSeeded(ST, y);
  for (const seat of s.json.seats) for (const c of seat.candidates) {
    all.push({ candidateId: s.idOf(seat.constNo, c), year: y, constNo: seat.constNo, name: c.name, partyId: c.partyId, age: c.age });
  }
}
const groups = groupCandidacies(all);
fs.writeFileSync(path.join(DB_DIR, STATES[ST].linksSeed), emitLinksSeed(groups, STATES[ST].linksSeedName) + '\n');
fs.writeFileSync(path.join(dataDir(ST), 'links-review.json'), JSON.stringify(groups.filter(g => g.confidence === 'review'), null, 1) + '\n');
const count = (c: string) => groups.filter(g => g.confidence === c).length;
console.log(`groups: ${count('high')} high, ${count('medium')} medium, ${count('review')} review (not linked)`);
