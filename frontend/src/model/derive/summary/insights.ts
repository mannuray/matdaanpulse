import { allianceByParty, colorOf, compact, seatLabel, shortName } from './shared';
import type { SummaryContext, SummaryRow, SummarySection } from './types';

const SEATS_PER_SPLIT = 10;

interface SplitSeat { constId: string; winnerAlliance: string; margin: number; spoilerVotes: number }

/**
 * InsightsSection.tsx:20-136. Needs full candidate lists (a seat with 3+ candidates), like the legacy;
 * everything is matched case-insensitively.
 */
export function insightsSummary(ctx: SummaryContext): SummarySection[] {
  const cc = ctx.constCandidates;
  if (!cc || cc.size === 0) return [];
  if (![...cc.values()].some(c => c.length > 2)) return [];
  const up = (s: string) => s.toUpperCase();
  const al = new Map([...allianceByParty(ctx.alliances)].map(([p, a]) => [up(p), a]));
  const alliances = new Map(ctx.alliances.map(a => [up(a.id), a]));
  const splits = ctx.voteSplits ?? [];
  const seatName = new Map(ctx.seats.map(s => [s.id, seatLabel(s.name)]));
  const nameOf = (id: string) => seatName.get(id) ?? shortName(id);

  const results = splits.map(config => ({ config, seats: [] as SplitSeat[] }));
  const two: string[] = [];
  const three: string[] = [];
  const multi: string[] = [];
  let analyzed = 0;

  for (const [constId, cands] of cc) {
    if (!cands || cands.length < 3) continue;
    analyzed++;
    const total = cands.reduce((s, c) => s + (c.votes || 0), 0);
    if (total === 0) continue;
    const thirdShare = (cands[2].votes / total) * 100;
    const topTwoShare = ((cands[0].votes + cands[1].votes) / total) * 100;
    if (topTwoShare >= 80) two.push(constId);
    else if (thirdShare >= 15) three.push(constId);
    if (cands.filter(c => (c.votes / total) * 100 >= 10).length >= 3) multi.push(constId);

    if (splits.length === 0) continue;
    const winner = cands[0];
    const winnerMargin = winner.votes - cands[1].votes;
    const runnerUpParty = up(cands[1].party_id);
    const runnerUpAlliance = al.get(runnerUpParty)?.id;
    for (const sr of results) {
      const hurts = up(sr.config.hurts);
      // The split config may target the runner-up party directly or its alliance.
      if (!(hurts === runnerUpParty || (runnerUpAlliance && hurts === up(runnerUpAlliance)))) continue;
      const spoiler = cands.find(c => up(c.party_id) === up(sr.config.spoiler));
      if (!spoiler) continue;
      // Cumulative: all configured spoilers hurting the same alliance count together.
      const cumulative = splits.filter(v => up(v.hurts) === hurts)
        .reduce((sum, v) => sum + (cands.find(c => up(c.party_id) === up(v.spoiler))?.votes ?? 0), 0);
      if (spoiler.votes > winnerMargin || cumulative > winnerMargin) {
        sr.seats.push({ constId, winnerAlliance: al.get(up(winner.party_id))?.name ?? winner.party_id, margin: winnerMargin, spoilerVotes: spoiler.votes });
      }
    }
  }
  results.forEach(r => r.seats.sort((a, b) => a.margin - b.margin));
  const affected = new Set<string>();
  results.forEach(r => r.seats.forEach(s => affected.add(s.constId)));

  const row = (id: string, labelKey: string, ids: string[] | number): SummaryRow => ({
    id, label: id, labelKey, value: Array.isArray(ids) ? ids.length : ids, valueFormat: 'int', seatIds: Array.isArray(ids) ? ids : undefined,
  });
  // Legacy order: "Vote split analysis" numbers, one table per configured split, then the seat classification.
  const out: SummarySection[] = [{
    id: 'vote_split', titleKey: 'studio_sum_vote_split', layout: 'stats',
    rows: [row('analyzed', 'studio_row_analyzed', analyzed), row('three_way', 'studio_row_three_way_short', three), row('spoiler_affected', 'studio_row_spoiler_affected', [...affected])],
  }];
  for (const sr of results) {
    if (sr.seats.length === 0) continue;
    const hurtsName = alliances.get(up(sr.config.hurts))?.name ?? sr.config.hurts;
    out.push({
      id: `split:${sr.config.spoiler}`, titleKey: 'studio_sum_split_title', titleParams: { label: sr.config.label, count: sr.seats.length, hurts: hurtsName },
      columnsKeys: ['studio_col_margin', 'studio_col_spoiler_votes'], more: Math.max(0, sr.seats.length - SEATS_PER_SPLIT),
      rows: sr.seats.slice(0, SEATS_PER_SPLIT).map(s => ({
        id: `split:${sr.config.spoiler}:${s.constId}`, label: nameOf(s.constId), sub: s.winnerAlliance, value: s.margin, valueFormat: 'compact' as const,
        extra: [compact(s.spoilerVotes)], color: colorOf(ctx, sr.config.spoiler), seatIds: [s.constId], partyIds: [sr.config.spoiler],
      })),
    });
  }
  out.push({
    id: 'classification', titleKey: 'studio_sum_classification',
    rows: [
      row('two_way', 'studio_row_two_way', two),
      row('three_way', 'studio_row_three_way', three),
      row('multi_cornered', 'studio_row_multi_cornered', multi),
    ],
  });
  return out;
}
