/**
 * seed_bihar_leaders.sql: Tier A leaders (spec §7). Links each leader's Bihar candidacies to one person, fills profile
 * fields only where empty, records photo credits, and writes the leaders/cabinet watchlists into each Bihar manifest.
 * Persons are addressed through a candidate id (auto-created person ids differ per database); leaders without any Bihar
 * VS candidacy get a fixed id.
 */
import { runOnce } from '../seed-run-once';
import type { LeadersFile, LeaderRole, LeaderYear } from './leaders-data';
import type { CandidateJson } from './types';
import { similarity } from './names';
import type { Profile } from './profiles';
import { q } from './sql';
import { moveGuard } from './links';

export interface ResolvedPerson { key: string; name: string; candidateIds: string[]; fixedId: string | null; profile: Profile | null }

/** The state a leaders seed is for (Bihar's defaults keep seed_bihar_leaders.sql unchanged). */
export interface LeadersSeedOpts { stateId: number; stateName: string; slug: string; seedName: string; years: string[] }
export const BIHAR_LEADERS: LeadersSeedOpts = { stateId: 5, stateName: 'Bihar', slug: 'bihar', seedName: 'seed_bihar_leaders', years: ['2010', '2015', '2020', '2025'] };

/** A leader's name this close to the ballot name in the given seat identifies the candidacy. */
export const MIN_NAME_MATCH = 0.5;

/** The candidate in a seat that is this leader: closest name, the winner on a tie (two "Tapas Roy" in Maniktala 2026). */
export function pickCandidacy(candidates: CandidateJson[], leaderName: string): CandidateJson | null {
  const best = candidates.filter(x => x.partyId !== 'NOTA').map(x => ({ x, sim: similarity(x.name, leaderName) }))
    .sort((a, b) => b.sim - a.sim || Number(b.x.status === 'WON') - Number(a.x.status === 'WON'))[0];
  return best && best.sim >= MIN_NAME_MATCH ? best.x : null;
}

export function personExpr(p: ResolvedPerson): string {
  if (p.fixedId) return `${q(p.fixedId)}::uuid`;
  // The leader's best-linked person (most candidacies, then lowest candidate id): the curated or linked person when one
  // exists, not a one-off spelling of the earliest year. After the links below it is the person of every candidacy.
  return `(SELECT c.person_id FROM candidates c WHERE c.id IN (${p.candidateIds.map(q).join(', ')}) ORDER BY (SELECT count(*) FROM candidates c2 WHERE c2.person_id = c.person_id) DESC, c.id LIMIT 1)`;
}

const joinYears = (ys: string[]) => (ys.length < 2 ? ys.join('') : `${ys.slice(0, -1).join(', ')} and ${ys[ys.length - 1]}`);
const plural = (word: string, n: number) => (n === 1 ? word : `${word}s`);

/** One factual line from the curated roles, e.g. "Chief Minister of Bihar in the 2010, 2015 and 2020 governments." */
export function bioFor(key: string, f: LeadersFile, opts: Pick<LeadersSeedOpts, 'stateName' | 'years'> = BIHAR_LEADERS): string | null {
  const groups: { role: string; kind: 'leader' | 'cabinet'; years: string[] }[] = [];
  for (const y of opts.years) {
    const e = f.elections[y as LeaderYear];
    const add = (r: LeaderRole, kind: 'leader' | 'cabinet') => {
      if (r.key !== key) return;
      const g = groups.find(x => x.role === r.role && x.kind === kind);
      if (g) { if (!g.years.includes(y)) g.years.push(y); } else groups.push({ role: r.role, kind, years: [y] });
    };
    e.leaders.forEach(r => add(r, 'leader'));
    e.cabinet.forEach(r => add(r, 'cabinet'));
  }
  if (!groups.length) return null;
  const parts = groups.map(({ role, kind, years }) => {
    const ys = joinYears(years);
    if (/^leader of the opposition$/i.test(role)) return `${role} after the ${ys} ${plural('election', years.length)}`;
    if (/candidate/i.test(role)) return `${role} in the ${ys} ${plural('election', years.length)}`;
    if (kind === 'cabinet') return `${role} in the ${ys} ${plural('government', years.length)}`;
    return `${role} of ${opts.stateName} in the ${ys} ${plural('government', years.length)}`;
  });
  return `${parts.join('; ')}.`;
}

export function emitLeadersSeed(f: LeadersFile, people: ResolvedPerson[], electionIds: Record<string, string>, opts: LeadersSeedOpts = BIHAR_LEADERS): string {
  const byKey = new Map(people.map(p => [p.key, p]));
  const always: string[] = [];
  const fixed = people.filter(p => p.fixedId);
  if (fixed.length) {
    always.push('INSERT INTO persons (id, name) VALUES', fixed.map(p => `  (${q(p.fixedId)}, ${q(p.name)})`).join(',\n'), 'ON CONFLICT (id) DO NOTHING;');
  }
  const credited = people.filter(p => p.profile?.photo_url && p.profile.credit);
  if (credited.length) {
    always.push('INSERT INTO image_credits (url, source_url, author, licence) VALUES',
      credited.map(p => `  (${q(p.profile!.photo_url)}, ${q(p.profile!.credit!.source_url)}, ${q(p.profile!.credit!.author)}, ${q(p.profile!.credit!.licence)})`).join(',\n'),
      'ON CONFLICT (url) DO NOTHING;');
  }

  const body: string[] = [
    '-- Link each leader\'s candidacies to the best-linked person. A candidacy moves from a one-candidacy person or from a',
    '-- person whose candidacies all belong to this leader (leaders.json is curated); never from a merge, a split or a',
    '-- person with an admin-entered profile.',
  ];
  for (const p of people.filter(x => x.candidateIds.length > 1)) {
    const expr = personExpr(p);
    const ids = p.candidateIds.map(q).join(', ');
    body.push(`UPDATE candidates c SET person_id = ${expr}`,
      `WHERE c.id IN (${ids}) AND c.person_id <> ${expr}`,
      `  AND ((SELECT count(*) FROM candidates c2 WHERE c2.person_id = c.person_id) = 1`,
      `       OR NOT EXISTS (SELECT 1 FROM candidates c3 WHERE c3.person_id = c.person_id AND c3.id NOT IN (${ids})))`,
      ...moveGuard('c.person_id', 'c.id').map((l, i, all) => (i === all.length - 1 ? `${l};` : l)));
  }

  body.push('', '-- Profiles, fill-only (admin edits win)');
  for (const p of people) {
    const pr = p.profile;
    const set = [
      pr?.photo_url ? `photo_url = COALESCE(photo_url, ${q(pr.photo_url)})` : null,
      pr?.date_of_birth ? `date_of_birth = COALESCE(date_of_birth, ${q(pr.date_of_birth)}::date)` : null,
      pr?.gender ? `gender = COALESCE(gender, ${q(pr.gender)})` : null,
      pr?.wikipedia_url ? `wikipedia_url = COALESCE(wikipedia_url, ${q(pr.wikipedia_url)})` : null,
      bioFor(p.key, f, opts) ? `bio = COALESCE(bio, ${q(bioFor(p.key, f, opts))})` : null,
      `state_id = COALESCE(state_id, ${opts.stateId})`,
    ].filter(Boolean);
    body.push(`UPDATE persons SET ${set.join(', ')} WHERE id = ${personExpr(p)};`);
  }

  body.push('', '-- Manifests: leaders and cabinet watchlists by person_id');
  for (const y of opts.years) {
    const e = f.elections[y as LeaderYear];
    const list = (id: string, name: string, roles: LeaderRole[]) => {
      if (!roles.length) return null;
      const entries = roles.map(r => {
        const p = byKey.get(r.key);
        if (!p) throw new Error(`${y}: unknown leader ${r.key}`);
        const seat = f.people.find(x => x.key === r.key)?.candidacies.find(c => String(c.year) === y)?.const_id ?? '';
        return `jsonb_build_object('name', ${q(p.name)}, 'party_id', ${q(r.party_id)}, 'const_id', ${q(seat)}, 'role', ${q(r.role)}, 'person_id', (${personExpr(p)})::text)`;
      });
      return `jsonb_build_object('id', ${q(id)}, 'name', ${q(name)}, 'entries', jsonb_build_array(\n    ${entries.join(',\n    ')}))`;
    };
    const lists = [list('leaders', 'Leaders', e.leaders), list('cabinet', 'Cabinet', e.cabinet)].filter(Boolean);
    if (!lists.length) continue;
    const arr = `jsonb_build_array(\n  ${lists.join(',\n  ')})`;
    const noEntries = (col: string) => `NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${col}->'watchlists', '[]'::jsonb)) w WHERE jsonb_array_length(COALESCE(w->'entries', '[]'::jsonb)) > 0)`;
    // Only a JSON manifest (not a URL) whose watchlists have no entries yet; admin-built lists are never replaced.
    body.push(`UPDATE elections SET manifest_url = (manifest_url::jsonb || jsonb_build_object('watchlists', ${arr}))::text`,
      `WHERE id = ${q(electionIds[y])} AND manifest_url LIKE '{%' AND CASE WHEN manifest_url LIKE '{%' THEN ${noEntries('manifest_url::jsonb')} ELSE false END;`);
    // A draft open in the admin gets the same lists, so publishing it does not drop them.
    body.push(`UPDATE elections SET manifest_draft = manifest_draft || jsonb_build_object('watchlists', ${arr})`,
      `WHERE id = ${q(electionIds[y])} AND jsonb_typeof(manifest_draft) = 'object' AND ${noEntries('manifest_draft')};`);
  }

  return runOnce({
    name: opts.seedName,
    comment: [
      `Run once (seed_runs). ${opts.stateName} Tier A leaders, generated by scraper/src/bihar/leaders-cli.ts from the curated`,
      `scraper/data/${opts.slug}/leaders.json and leader-profiles.json: candidacy links (never moving curated or merged`,
      `persons), fill-only profile fields, and the leaders/cabinet watchlists of each ${opts.stateName} manifest (written once;`,
      'admins edit them afterwards). Persons and image credits above the guard are idempotent and run every time.',
    ],
    always,
    body,
  }).join('\n');
}
