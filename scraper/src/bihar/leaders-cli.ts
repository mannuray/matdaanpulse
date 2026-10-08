/**
 * Generate a state's leaders seed (seed_bihar_leaders.sql / seed_<slug>_leaders.sql) from its leaders.json +
 * leader-profiles.json. Usage: npx ts-node src/bihar/leaders-cli.ts [STATE] [--check]   (default BR; --check validates only)
 */
import * as fs from 'fs';
import * as path from 'path';
import { DB_DIR, loadSeeded, type Seeded } from './seeded';
import { emitLeadersSeed, candidacyOf, pickCandidacy, priorCandidacies, type EarlierCandidacy, type ResolvedPerson } from './leaders-seed';
import { validateLeaders, type LeadersFile } from './leaders-data';
import { stableUuid } from './match';
import { similarity } from './names';
import { electionOf, electionsOf, parseState } from './elections';
import { trackOf } from './current-track';
import type { Profile } from './profiles';
import type { Year } from './types';


const ST = parseState(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'BR');
const track = trackOf(ST);
const leaders: LeadersFile = JSON.parse(fs.readFileSync(path.join(track.dir, 'leaders.json'), 'utf8'));
const years = Object.keys(leaders.elections).map(Number).sort();
const profilesFile = path.join(track.dir, 'leader-profiles.json');
const profiles: Record<string, Profile> = fs.existsSync(profilesFile) ? JSON.parse(fs.readFileSync(profilesFile, 'utf8')) : {};
// Every year a leader has a candidacy in (their own history), plus the years with curated roles.
const candYears = new Set([...years, ...leaders.people.flatMap(p => p.candidacies.map(c => c.year))]);
if (process.argv.includes('--add-history')) electionsOf(ST).filter(e => e.year < Math.max(...years)).forEach(e => candYears.add(e.year));
const seeded = new Map<number, Seeded>(([...candYears].sort() as Year[]).map(y => [y, loadSeeded(ST, y)]));

/** --add-history: add each leader's own earlier candidacies (any seat; priorCandidacies) to leaders.json and stop. */
if (process.argv.includes('--add-history')) {
  const latest = Math.max(...years);
  const earlier: EarlierCandidacy[] = [...seeded].filter(([y]) => y < latest).flatMap(([y, s]) =>
    s.json.seats.flatMap(seat => seat.candidates.map(c => ({ year: y, constId: s.seat(seat.constNo).id, name: c.name, partyId: c.partyId, age: c.age }))));
  for (const p of leaders.people) {
    const cur = p.candidacies.find(c => c.year === latest);
    const parties = new Set(Object.values(leaders.elections).flatMap(e => [...e.leaders, ...e.cabinet]).filter(r => r.key === p.key).map(r => r.party_id));
    let age: number | null = null;
    let namesakes = 0;
    if (cur) {
      const s = seeded.get(latest)!;
      const seat = s.json.seats.find(x => s.seat(x.constNo).id === cur.const_id)!;
      const me = pickCandidacy(seat.candidates, p.name);
      age = me?.age ?? null;
      namesakes = s.json.seats.flatMap(x => x.candidates).filter(x => x !== me && x.partyId !== 'NOTA' && similarity(x.name, p.name) >= 0.8).length;
    }
    const add = priorCandidacies(p.name, parties, { year: latest, age, namesakes }, earlier).filter(a => !p.candidacies.some(c => c.year === a.year));
    p.candidacies.push(...add);
    p.candidacies.sort((a, b) => a.year - b.year || a.const_id.localeCompare(b.const_id));
    if (add.length) console.log(`${p.name}: ${add.map(a => `${a.year} ${a.const_id}`).join(', ')}`);
  }
  fs.writeFileSync(path.join(track.dir, 'leaders.json'), JSON.stringify(leaders, null, 2) + '\n');
  process.exit(0);
}

const errs = validateLeaders(leaders, Object.fromEntries([...seeded].map(([y, s]) => [String(y), new Set(s.seed.constituencies.map(k => k.id))])));
if (errs.length) { console.error(`leaders.json is invalid:\n  ${errs.join('\n  ')}`); process.exit(1); }
if (process.argv.includes('--check')) { console.log(`${track.state.name}: leaders.json valid (${leaders.people.length} people)`); process.exit(0); }

const people: ResolvedPerson[] = leaders.people.map(p => {
  const candidateIds = [...p.candidacies].sort((a, b) => a.year - b.year).map(c => {
    const s = seeded.get(c.year)!;
    const seat = s.json.seats.find(x => s.seat(x.constNo).id === c.const_id)!;
    const best = candidacyOf(seat.candidates, p.name, c);
    if (!best) throw new Error(`${p.key}: no candidate like "${p.name}" in ${c.year} ${c.const_id}`);
    return s.idOf(seat.constNo, best);
  });
  return { key: p.key, name: p.name, candidateIds, fixedId: candidateIds.length ? null : stableUuid(track.leaderNs, p.key), profile: profiles[p.key] ?? null };
});

const ids = Object.fromEntries(years.map(y => [String(y), electionOf(ST, y).electionId]));
fs.writeFileSync(path.join(DB_DIR, `${track.leadersSeed}.sql`), emitLeadersSeed(leaders, people, ids, track.leadersOpts(years)) + '\n');
const entries = (y: string) => leaders.elections[y].leaders.length + leaders.elections[y].cabinet.length;
console.log(`${people.length} leaders, ${people.reduce((a, p) => a + p.candidateIds.length, 0)} candidacies, ${people.filter(p => p.profile?.photo_url).length} photos;`,
  `manifest entries ${years.map(y => `${y} ${entries(String(y))}`).join(', ')}`);
