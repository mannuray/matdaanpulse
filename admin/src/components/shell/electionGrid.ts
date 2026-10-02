import type { Election } from '../../types';

export interface ElectionRow {
  /** "Lok Sabha" or the state name, e.g. "West Bengal". */
  label: string;
  /** Newest first. */
  elections: Election[];
}

const LOK_SABHA = 'Lok Sabha';

/** Row label: the state for a Vidhan Sabha election ("Bihar Vidhan Sabha 2025" → "Bihar"), else "Lok Sabha". */
export function electionGroup(e: Pick<Election, 'name' | 'type'>): string {
  if (e.type === 'LS') return LOK_SABHA;
  return e.name.replace(/\s*\b(Vidhan Sabha|Assembly|General)\b.*$/i, '').trim() || e.name;
}

/** One row per state, Lok Sabha first then states A–Z; years newest first. */
export function groupElections(elections: Election[]): ElectionRow[] {
  const rows = new Map<string, Election[]>();
  for (const e of elections) {
    const label = electionGroup(e);
    rows.set(label, [...(rows.get(label) ?? []), e]);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => (a === LOK_SABHA ? -1 : b === LOK_SABHA ? 1 : a.localeCompare(b)))
    .map(([label, list]) => ({ label, elections: [...list].sort((x, y) => y.year - x.year) }));
}

/** Live first, then upcoming (soonest year first). */
export function pinnedElections(elections: Election[]): Election[] {
  const rank = (e: Election) => (e.status === 'Live' ? 0 : 1);
  return elections
    .filter((e) => e.status === 'Live' || e.status === 'Upcoming')
    .sort((a, b) => rank(a) - rank(b) || a.year - b.year);
}

const TYPE_WORDS: Record<Election['type'], string[]> = {
  LS: ['ls', 'lok', 'sabha', 'general', 'national'],
  VS: ['vs', 'vidhan', 'sabha', 'assembly', 'state'],
};

/**
 * Every space-separated token must match something: a word of the state ("west", "beng"), its initials
 * ("wb", "tn"), the year ("2021", "20"), the type ("ls", "vidhan") or the status ("live", "upcoming").
 */
export function matchesElection(e: Election, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const words = electionGroup(e).toLowerCase().split(/[\s&-]+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join('');
  return tokens.every((t) =>
    words.some((w) => w.startsWith(t))
    || (t.length >= 2 && initials === t)
    || String(e.year).startsWith(t)
    || TYPE_WORDS[e.type].some((w) => w.startsWith(t))
    || e.status.toLowerCase().startsWith(t));
}
