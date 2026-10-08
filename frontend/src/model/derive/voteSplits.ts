import type { VoteSplitConfig } from '../types';

/**
 * The one vote-split rule (spoilers and three-way contests), shared by the map fill, the insight chips and the
 * summary, so they always agree. Matching ignores case.
 */
interface Cand { party_id: string; votes: number }

const up = (s: string | null | undefined) => (s ?? '').toUpperCase();
const ranked = <C extends Cand>(cands: C[]) => [...cands].sort((a, b) => b.votes - a.votes);

/**
 * The configured splits that cost this seat (their spoiler ids, config order): the runner-up is on the side a split
 * hurts (its party, or its alliance), the spoiler is neither winner nor runner-up, and the spoiler's votes, or all
 * configured spoilers against that side together, exceed the winning margin.
 */
export function seatSplits(cands: Cand[], splits: VoteSplitConfig[], allianceOf: (partyId: string) => string | null): string[] {
  if (cands.length < 3 || !splits.length) return [];
  const [w, r, ...rest] = ranked(cands);
  const margin = w.votes - r.votes;
  const side = new Set([up(r.party_id), up(allianceOf(r.party_id))].filter(Boolean));
  const votesOf = (spoiler: string) => rest.find(c => up(c.party_id) === up(spoiler))?.votes ?? 0;
  return splits.filter(cfg => {
    if (!side.has(up(cfg.hurts)) || !rest.some(c => up(c.party_id) === up(cfg.spoiler))) return false;
    const together = splits.filter(v => up(v.hurts) === up(cfg.hurts)).reduce((s, v) => s + votesOf(v.spoiler), 0);
    return votesOf(cfg.spoiler) > margin || together > margin;
  }).map(cfg => cfg.spoiler);
}

/** A three-way contest: the top two have under 80% of the votes and the third at least 15%. */
export function isThreeWay(cands: Cand[]): boolean {
  if (cands.length < 3) return false;
  const [a, b, c] = ranked(cands);
  const total = cands.reduce((s, x) => s + (x.votes || 0), 0);
  if (!total) return false;
  return ((a.votes + b.votes) / total) * 100 < 80 && (c.votes / total) * 100 >= 15;
}
