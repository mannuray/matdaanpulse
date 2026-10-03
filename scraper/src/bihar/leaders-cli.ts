/**
 * Generate a state's leaders seed (seed_bihar_leaders.sql / seed_<slug>_leaders.sql) from its leaders.json +
 * leader-profiles.json. Usage: npx ts-node src/bihar/leaders-cli.ts [STATE] [--check]   (default BR; --check validates only)
 */
import * as fs from 'fs';
import * as path from 'path';
import { DB_DIR, loadSeeded, type Seeded } from './seeded';
import { emitLeadersSeed, pickCandidacy, type ResolvedPerson } from './leaders-seed';
import { validateLeaders, type LeadersFile } from './leaders-data';
import { stableUuid } from './match';
import { electionOf, parseState } from './elections';
import { trackOf } from './current-track';
import { BIHAR_LEADERS } from './leaders-seed';
import type { Profile } from './profiles';
import type { Year } from './types';


const ST = parseState(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'BR');
const track = trackOf(ST);
const leaders: LeadersFile = JSON.parse(fs.readFileSync(path.join(track.dir, 'leaders.json'), 'utf8'));
const years = Object.keys(leaders.elections).map(Number).sort();
const profilesFile = path.join(track.dir, 'leader-profiles.json');
const profiles: Record<string, Profile> = fs.existsSync(profilesFile) ? JSON.parse(fs.readFileSync(profilesFile, 'utf8')) : {};
const seeded = new Map<number, Seeded>((years as Year[]).map(y => [y, loadSeeded(ST, y)]));

const errs = validateLeaders(leaders, Object.fromEntries([...seeded].map(([y, s]) => [String(y), new Set(s.seed.constituencies.map(k => k.id))])));
if (errs.length) { console.error(`leaders.json is invalid:\n  ${errs.join('\n  ')}`); process.exit(1); }
if (process.argv.includes('--check')) { console.log(`${track.state.name}: leaders.json valid (${leaders.people.length} people)`); process.exit(0); }

const people: ResolvedPerson[] = leaders.people.map(p => {
  const candidateIds = [...p.candidacies].sort((a, b) => a.year - b.year).map(c => {
    const s = seeded.get(c.year)!;
    const seat = s.json.seats.find(x => s.seat(x.constNo).id === c.const_id)!;
    const best = pickCandidacy(seat.candidates, p.name);
    if (!best) throw new Error(`${p.key}: no candidate like "${p.name}" in ${c.year} ${c.const_id}`);
    return s.idOf(seat.constNo, best);
  });
  return { key: p.key, name: p.name, candidateIds, fixedId: candidateIds.length ? null : stableUuid(track.leaderNs, p.key), profile: profiles[p.key] ?? null };
});

const ids = Object.fromEntries(years.map(y => [String(y), electionOf(ST, y).electionId]));
const opts = ST === 'BR' ? BIHAR_LEADERS : { stateId: track.state.stateId, stateName: track.state.name, slug: track.state.slug, seedName: track.leadersSeed, years: years.map(String) };
fs.writeFileSync(path.join(DB_DIR, `${track.leadersSeed}.sql`), emitLeadersSeed(leaders, people, ids, opts) + '\n');
const entries = (y: string) => leaders.elections[y].leaders.length + leaders.elections[y].cabinet.length;
console.log(`${people.length} leaders, ${people.reduce((a, p) => a + p.candidateIds.length, 0)} candidacies, ${people.filter(p => p.profile?.photo_url).length} photos;`,
  `manifest entries ${years.map(y => `${y} ${entries(String(y))}`).join(', ')}`);
