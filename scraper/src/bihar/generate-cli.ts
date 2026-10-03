/**
 * Generate the Bihar seeds from scraper/data/bihar/*.json and the current database/seed_bihar_vs_<year>.sql ids.
 * Writes review-<year>.json; refuses (exit 1) while any old row is unmatched without a decision.
 * Usage: npx ts-node src/bihar/generate-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
import { readExistingSeed } from './existing-seed';
import { matchYear, LOW_SIMILARITY, type Decision } from './match';
import { emitCorrections, emitParties, emitYear, type Plan } from './emit';
import { validateElection } from './crosscheck';
import type { ElectionJson, PartyEntry, Year } from './types';

const DB_DIR = path.resolve(__dirname, '../../../database');
const YEARS_ORDER: Year[] = [2010, 2015, 2020, 2025];
const decisions: Record<string, Decision> = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'decisions.json'), 'utf8'));
const aliases: Record<string, string> = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'party-aliases.json'), 'utf8'));

const plans: Plan[] = [];
let blocked = 0;
for (const y of YEARS_ORDER) {
  const json: ElectionJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `vs-${y}.json`), 'utf8'));
  const errs = validateElection(json);
  if (errs.length) { console.error(`vs-${y}.json fails validation:\n  ${errs.join('\n  ')}`); process.exit(1); }
  const seed = readExistingSeed(fs.readFileSync(path.join(DB_DIR, `seed_bihar_vs_${y}.sql`), 'utf8'));
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
if (blocked) { console.error(`${blocked} old rows need a decision in scraper/data/bihar/decisions.json (see review-<year>.json). Nothing written.`); process.exit(1); }

const parties = new Map<string, PartyEntry>();
for (const p of plans.flatMap(pl => pl.json.parties)) if (!['IND', 'NOTA'].includes(p.id)) parties.set(p.id, p);
fs.writeFileSync(path.join(DB_DIR, 'seed_bihar_parties.sql'), emitParties([...parties.values()]));
// Run-once seed: frozen after its first generation (it may already be applied in production); a later fix is a _v2 file.
const corrections = path.join(DB_DIR, 'seed_bihar_corrections_v1.sql');
if (!fs.existsSync(corrections)) fs.writeFileSync(corrections, emitCorrections(plans));
else console.log('seed_bihar_corrections_v1.sql exists (frozen run-once seed); not rewritten');
for (const p of plans) fs.writeFileSync(path.join(DB_DIR, `seed_bihar_vs_${p.json.year}.sql`), emitYear(p));
console.log('Wrote seed_bihar_parties.sql and seed_bihar_vs_{2010,2015,2020,2025}.sql');
