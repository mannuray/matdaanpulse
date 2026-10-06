/**
 * Build a state's person-links seed + review file.
 * Usage: npx ts-node src/bihar/links-cli.ts <STATE>        → v1 (the historical years; shipped, must regenerate unchanged)
 *        npx ts-node src/bihar/links-cli.ts <STATE> 2026   → seed_<slug>_person_links_v2.sql: links that year's candidates
 *          to the persons of earlier years, within the same delimitation only (Assam 2026 has none to link to).
 */
import * as fs from 'fs';
import * as path from 'path';
import { dataDir } from './load';
import { DB_DIR, loadSeeded } from './seeded';
import { emitLinksSeed, groupCandidacies, onlyGroupsTouching, type Candidacy } from './links';
import { STATES, electionsOf, parseState } from './elections';

const ST = parseState(process.argv[2]);
const year = process.argv[3] ? Number(process.argv[3]) : null;
const state = STATES[ST];
// v1 = the historical track: old-seed elections, plus new ones up to 2022 (Phase 3A states); later elections are linked by v2.
const elections = electionsOf(ST).filter(e => (year ? e.year <= year : !e.newElection || e.year <= 2022));
const all: Candidacy[] = [];
for (const e of elections) {
  const s = loadSeeded(ST, e.year);
  const era = e.newElection?.delimitation;
  for (const seat of s.json.seats) for (const c of seat.candidates) {
    all.push({ candidateId: s.idOf(seat.constNo, c), year: e.year, constNo: seat.constNo, name: c.name, partyId: c.partyId, age: c.age, ...(era ? { era } : {}) });
  }
}
const loose = { loose: !!STATES[ST].looseNames };
const groups = year ? onlyGroupsTouching(groupCandidacies(all, loose), year) : groupCandidacies(all, loose);
const count = (c: string) => groups.filter(g => g.confidence === c).length;
if (year && groups.length === 0) {
  console.log(`${state.name} ${year}: no seat-level links (no earlier election on the same boundaries); no seed written`);
} else {
  const seedName = year ? `seed_${state.slug}_person_links_v2` : state.linksSeedName;
  const label = `${state.name} VS ${elections[0].year}-${elections.at(-1)!.year}`;
  fs.writeFileSync(path.join(DB_DIR, `${seedName}.sql`), (year ? emitLinksSeed(groups, seedName, label) : emitLinksSeed(groups, seedName)) + '\n');
  fs.writeFileSync(path.join(dataDir(ST), year ? `links-review-${year}.json` : 'links-review.json'), JSON.stringify(groups.filter(g => g.confidence === 'review'), null, 1) + '\n');
  console.log(`groups: ${count('high')} high, ${count('medium')} medium, ${count('review')} review (not linked) → ${seedName}.sql`);
}
