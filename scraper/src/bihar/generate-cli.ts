/**
 * Generate a state's seeds from scraper/data/<slug>/*.json and the current database/<year seed> ids.
 * Writes review-<year>.json; refuses (exit 1) while any old row is unmatched without a decision.
 * Usage: npx ts-node src/bihar/generate-cli.ts <STATE>   (e.g. BR, WB, TN, KL, AS, PY)
 */
import * as fs from 'fs';
import * as path from 'path';
import { PARTY_DIR, dataDir } from './load';
import { STATES, electionOf, electionsOf, parseState } from './elections';
import { readExistingSeed } from './existing-seed';
import { matchYear, LOW_SIMILARITY, type Decision } from './match';
import { changedRows, emitCorrections, emitParties, emitYear, type Plan } from './emit';
import { validateElection } from './crosscheck';
import type { ElectionJson, PartyEntry } from './types';

const DB_DIR = path.resolve(__dirname, '../../../database');
const ST = parseState(process.argv[2]);
const state = STATES[ST];
const DATA_DIR = dataDir(ST);
const decisionsFile = path.join(DATA_DIR, 'decisions.json');
const decisions: Record<string, Decision> = fs.existsSync(decisionsFile) ? JSON.parse(fs.readFileSync(decisionsFile, 'utf8')) : {};
const aliases: Record<string, string> = JSON.parse(fs.readFileSync(path.join(PARTY_DIR, 'party-aliases.json'), 'utf8'));

const plans: Plan[] = [];
let blocked = 0;
for (const y of electionsOf(ST).map(e => e.year)) {
  const json: ElectionJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `vs-${y}.json`), 'utf8'));
  const errs = validateElection(json, electionOf(ST, y));
  if (errs.length) { console.error(`vs-${y}.json fails validation:\n  ${errs.join('\n  ')}`); process.exit(1); }
  const seed = readExistingSeed(fs.readFileSync(path.join(DB_DIR, state.yearSeed(y)), 'utf8'));
  const matches = matchYear(json, seed, decisions, aliases);
  const review = {
    unmatchedOld: matches.flatMap(m => m.unmatchedOld.map(o => ({ ...o, seat: m.constId, eci: json.seats.find(s => m.constId.includes(`_${s.constNo}_`))?.candidates.map(c => `${c.serial} ${c.name} (${c.partyId})`) }))),
    lowSimilarity: matches.flatMap((m, i) => m.matched.filter(x => x.similarity < LOW_SIMILARITY)
      .map(x => ({ oldId: x.old.id, oldName: x.old.name, newName: json.seats[i].candidates.find(c => c.serial === x.serial)!.name, party: x.old.partyId, seat: m.constId, similarity: Math.round(x.similarity * 100) / 100 }))),
    deleted: matches.flatMap(m => m.deleted.map(o => ({ ...o, reason: (decisions[o.id] as { reason: string }).reason }))),
  };
  fs.writeFileSync(path.join(DATA_DIR, `review-${y}.json`), JSON.stringify(review, null, 1) + '\n');
  console.log(`${y}: ${matches.reduce((a, m) => a + m.matched.length, 0)} matched, ${review.unmatchedOld.length} unmatched, ${review.lowSimilarity.length} low-similarity, ${review.deleted.length} deleted`);
  blocked += review.unmatchedOld.length;
  plans.push({ json, seed, matches });
}
if (blocked) { console.error(`${blocked} old rows need a decision in scraper/data/${state.slug}/decisions.json (see review-<year>.json). Nothing written.`); process.exit(1); }

const parties = new Map<string, PartyEntry>();
for (const p of plans.flatMap(pl => pl.json.parties)) if (!['IND', 'NOTA'].includes(p.id)) parties.set(p.id, p);
fs.writeFileSync(path.join(DB_DIR, state.partiesSeed), emitParties([...parties.values()], state.name, `${electionsOf(ST)[0].year}-${electionsOf(ST).at(-1)!.year}`));
// Run-once seed: frozen after its first generation (it may already be applied in production); a later fix is a _v2 file.
const corrections = path.join(DB_DIR, state.correctionsSeed);
if (fs.existsSync(corrections)) {
  // Existing DBs never see a changed row of a year seed (ON CONFLICT DO NOTHING); only fresh DBs would. Refuse.
  const changed = plans.flatMap(p => changedRows(fs.readFileSync(path.join(DB_DIR, state.yearSeed(p.json.year)), 'utf8'), emitYear(p))
    .map(id => `${p.json.year}: ${id}`));
  if (changed.length) {
    console.error(`${changed.length} existing rows would change; existing DBs would not get them. Write a ${state.correctionsSeed.replace('_v1.sql', '_v2')} for:\n  ${changed.slice(0, 50).join('\n  ')}`);
    process.exit(1);
  }
}
if (!fs.existsSync(corrections)) fs.writeFileSync(corrections, emitCorrections(plans));
else console.log(`${state.correctionsSeed} exists (frozen run-once seed); not rewritten`);
for (const p of plans) fs.writeFileSync(path.join(DB_DIR, state.yearSeed(p.json.year)), emitYear(p));
console.log(`Wrote ${state.partiesSeed} and ${plans.map(p => state.yearSeed(p.json.year)).join(', ')}`);
