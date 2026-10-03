/** Generate database/seed_bihar_leaders.sql from leaders.json + leader-profiles.json. Usage: npx ts-node src/bihar/leaders-cli.ts */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
import { DB_DIR, loadSeeded, type Seeded } from './seeded';
import { emitLeadersSeed, type ResolvedPerson } from './leaders-seed';
import { validateLeaders, type LeadersFile } from './leaders-data';
import { stableUuid } from './match';
import { similarity } from './names';
import { YEARS } from './years';
import type { Profile } from './profiles';
import type { Year } from './types';

/** A leader's name this close to the ballot name in the given seat identifies the candidacy. */
const MIN_NAME_MATCH = 0.5;

const leaders: LeadersFile = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leaders.json'), 'utf8'));
const profilesFile = path.join(DATA_DIR, 'leader-profiles.json');
const profiles: Record<string, Profile> = fs.existsSync(profilesFile) ? JSON.parse(fs.readFileSync(profilesFile, 'utf8')) : {};
const seeded = new Map<number, Seeded>(([2010, 2015, 2020, 2025] as Year[]).map(y => [y, loadSeeded(y)]));

const errs = validateLeaders(leaders, Object.fromEntries([...seeded].map(([y, s]) => [String(y), new Set(s.seed.constituencies.map(k => k.id))])));
if (errs.length) { console.error(`leaders.json is invalid:\n  ${errs.join('\n  ')}`); process.exit(1); }

const people: ResolvedPerson[] = leaders.people.map(p => {
  const candidateIds = [...p.candidacies].sort((a, b) => a.year - b.year).map(c => {
    const s = seeded.get(c.year)!;
    const seat = s.json.seats.find(x => s.seat(x.constNo).id === c.const_id)!;
    const best = seat.candidates.filter(x => x.partyId !== 'NOTA').map(x => ({ x, sim: similarity(x.name, p.name) })).sort((a, b) => b.sim - a.sim)[0];
    if (!best || best.sim < MIN_NAME_MATCH) throw new Error(`${p.key}: no candidate like "${p.name}" in ${c.year} ${c.const_id} (best: ${best?.x.name})`);
    return s.idOf(seat.constNo, best.x);
  });
  return { key: p.key, name: p.name, candidateIds, fixedId: candidateIds.length ? null : stableUuid('bihar-leader', p.key), profile: profiles[p.key] ?? null };
});

const ids = Object.fromEntries(Object.values(YEARS).map(c => [String(c.year), c.electionId]));
fs.writeFileSync(path.join(DB_DIR, 'seed_bihar_leaders.sql'), emitLeadersSeed(leaders, people, ids) + '\n');
const entries = (y: keyof LeadersFile['elections']) => leaders.elections[y].leaders.length + leaders.elections[y].cabinet.length;
console.log(`${people.length} leaders, ${people.reduce((a, p) => a + p.candidateIds.length, 0)} candidacies, ${people.filter(p => p.profile?.photo_url).length} photos;`,
  `manifest entries 2010 ${entries('2010')}, 2015 ${entries('2015')}, 2020 ${entries('2020')}, 2025 ${entries('2025')}`);
