import type { RunOnceSeed } from '../seed-run-once';
import { runOnce } from '../seed-run-once';
import { normName } from './names';
import { q } from './sql';

/** `era`: the delimitation the seat follows; seat numbers are only comparable within one (Assam 2026 is '2023'). */
export interface Candidacy { candidateId: string; year: number; constNo: number; name: string; partyId: string; age: number | null; era?: string }
export interface LinkGroup { key: string; confidence: 'high' | 'medium' | 'review'; members: Candidacy[] }

export const COMMON_NAMES = new Set([
  'ANIL KUMAR', 'SUNIL KUMAR', 'RAJESH KUMAR', 'RAMESH KUMAR', 'MANOJ KUMAR', 'VIJAY KUMAR', 'SANJAY KUMAR', 'AJAY KUMAR',
  'RAJU KUMAR', 'MUKESH KUMAR', 'RAKESH KUMAR', 'SANTOSH KUMAR', 'ASHOK KUMAR', 'DINESH KUMAR', 'PANKAJ KUMAR', 'AMIT KUMAR',
  'RAVI KUMAR', 'MOHD ANWAR', 'RAM KUMAR', 'SHIV KUMAR',
]);

/** Allowed difference (years) between declared ages and the years between two contests. */
export const AGE_SLACK = 2;

/**
 * Guards for moving a candidate (`cid`) away from its person (`pid`): never a merged person, never a candidate an admin
 * split off, never a person an admin gave a profile (photo, bio, Wikipedia, birth date).
 */
export const moveGuard = (pid: string, cid: string) => [
  `  AND NOT EXISTS (SELECT 1 FROM person_merges pm WHERE pm.duplicate->>'id' = ${pid}::text OR pm.keeper_ref = ${pid})`,
  `  AND NOT EXISTS (SELECT 1 FROM audit_logs al WHERE al.action = 'CANDIDATE_SPLIT' AND al.entity_type = 'candidate' AND al.entity_id = ${cid}::text)`,
  `  AND NOT EXISTS (SELECT 1 FROM persons pp WHERE pp.id = ${pid} AND (pp.photo_url IS NOT NULL OR pp.bio IS NOT NULL OR pp.wikipedia_url IS NOT NULL OR pp.date_of_birth IS NOT NULL))`,
];

/**
 * The name part of a link key. `loose` (Andhra: Telugu names change word order and initials between reports, "Nara
 * Chandrababu Naidu" / "Chandrababu Naidu Nara", "Y.S." / "Y S" / "Ys"): dots become spaces, runs of single letters
 * merge, words are sorted. Off by default, so the shipped states' keys (and seeds) do not change.
 */
export function linkKey(name: string, o: { loose?: boolean } = {}): string {
  const base = (s: string) => normName(s.replace(/\s+(alias|urf|@)\s+.*$/i, '')).replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
  if (!o.loose) return base(name);
  const merged: string[] = [];
  let initials = false; // the last word is a run of single letters ("Y S" → "YS")
  for (const w of base(name.replace(/\./g, ' ')).split(' ').filter(Boolean)) {
    if (w.length === 1 && initials) merged[merged.length - 1] += w;
    else { merged.push(w); initials = w.length === 1; }
  }
  return merged.sort().join(' ');
}

export function groupCandidacies(all: Candidacy[], o: { loose?: boolean } = {}): LinkGroup[] {
  const groups = new Map<string, Candidacy[]>();
  for (const x of all) {
    if (x.partyId === 'NOTA') continue;
    // The era joins the seat key only when set, so the 2008-era keys (and the order of the shipped seeds) stay the same.
    const key = `${linkKey(x.name, o)}|${x.era && x.era !== '2008' ? `${x.era}:` : ''}${x.constNo}`;
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  const out: LinkGroup[] = [];
  for (const [key, members] of groups) {
    const years = new Set(members.map(m => m.year));
    if (years.size < 2) continue;
    const sorted = [...members].sort((a, b) => a.year - b.year);
    const name = key.split('|')[0];
    const parties = new Set(members.map(m => m.partyId));
    const ind = parties.has('IND');
    // Ages are declared at nomination: between two contests a person ages by the years in between (±2).
    const aged = sorted.filter(m => m.age !== null);
    const fits = aged.every((m, i) => i === 0 || Math.abs((m.age! - aged[i - 1].age!) - (m.year - aged[i - 1].year)) <= AGE_SLACK);
    const allAged = aged.length === sorted.length;
    const review =
      years.size !== members.length ||           // two people in one year
      !name.includes(' ') ||                       // single-word names are too ambiguous
      !fits ||                                     // the ages contradict the years
      (COMMON_NAMES.has(name) && (parties.size > 1 || ind)) ||
      ((parties.size > 1 || ind) && !allAged);     // a party switch or an independent needs the ages to confirm it
    out.push({ key, confidence: review ? 'review' : parties.size === 1 && !ind ? 'high' : 'medium', members: sorted });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** The groups with a candidacy in `year` (a later seed adds that election's candidates to the persons already linked). */
export function onlyGroupsTouching(groups: LinkGroup[], year: number): LinkGroup[] {
  return groups.filter(g => g.members.some(m => m.year === year));
}

export function emitLinksSeed(groups: LinkGroup[], name = 'seed_bihar_person_links_v2', label = 'Bihar VS 2010-2025'): string {
  const linked = groups.filter(g => g.confidence !== 'review');
  const rows = linked.flatMap((g, i) => g.members.map(m => `(${i + 1}, ${q(m.candidateId)})`));
  const seed: RunOnceSeed = {
    name,
    comment: [
      `Run once (seed_runs). Links the same politician across ${label} (same name, same seat, two or more`,
      'years; generated by scraper/src/bihar/links-cli.ts from the ECI data). Each group anchors on its most-linked',
      'person; only candidates whose person is an auto-created single-candidacy person outside the merge log move,',
      'and never a split-off candidate or a person with an admin-entered profile, so curated persons and admin',
      'merges/splits are never undone. Groups need matching declared ages when the party changes or a member is IND.',
      'The orphan trigger deletes the emptied persons.',
    ],
    body: [
      'CREATE TEMP TABLE link_groups (g int, cid uuid) ON COMMIT DROP;',
      `INSERT INTO link_groups (g, cid) VALUES\n${rows.join(', ')};`,
      'WITH members AS (',
      '  SELECT lg.g, c.id AS cid, c.person_id AS pid, (SELECT count(*) FROM candidates c2 WHERE c2.person_id = c.person_id) AS n',
      '  FROM link_groups lg JOIN candidates c ON c.id = lg.cid',
      '), anchor AS (',
      '  SELECT DISTINCT ON (g) g, pid FROM members ORDER BY g, n DESC, cid',
      ')',
      'UPDATE candidates c SET person_id = a.pid',
      'FROM members m JOIN anchor a ON a.g = m.g',
      'WHERE c.id = m.cid AND m.pid <> a.pid AND m.n = 1',
      ...moveGuard('m.pid', 'm.cid').map((l, i, all) => (i === all.length - 1 ? `${l};` : l)),
    ],
  };
  return runOnce(seed).join('\n');
}
