import { allianceByParty, colorOf, int, seatLabel, shortName } from './shared';
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

  const out: SummarySection[] = [];
  const splitRows: SummaryRow[] = [];
  for (const sr of results) {
    if (sr.seats.length === 0) continue;
    const hurtsName = alliances.get(up(sr.config.hurts))?.name ?? sr.config.hurts;
    splitRows.push({
      id: `split:${sr.config.spoiler}`, label: sr.config.label, sub: hurtsName, value: sr.seats.length, valueFormat: 'int',
      color: colorOf(ctx, sr.config.spoiler), seatIds: sr.seats.map(s => s.constId), partyIds: [sr.config.spoiler],
    });
    // The closest seats of each split, right below its summary row (id `split:<spoiler>:<constId>`).
    sr.seats.slice(0, SEATS_PER_SPLIT).forEach(s => splitRows.push({
      id: `split:${sr.config.spoiler}:${s.constId}`, label: nameOf(s.constId), sub: s.winnerAlliance, value: s.margin, valueFormat: 'int',
      extra: [int(s.spoilerVotes)], color: colorOf(ctx, sr.config.spoiler), seatIds: [s.constId],
    }));
  }
  if (splitRows.length > 0) {
    out.push({ id: 'vote_split', titleKey: 'studio_sum_vote_split', columnsKeys: ['studio_col_margin', 'studio_col_spoiler_votes'], rows: splitRows });
  }
  const row = (id: string, labelKey: string, ids: string[] | number): SummaryRow => ({
    id, label: id, labelKey, value: Array.isArray(ids) ? ids.length : ids, valueFormat: 'int', seatIds: Array.isArray(ids) ? ids : undefined,
  });
  out.push({
    id: 'classification', titleKey: 'studio_sum_classification',
    rows: [
      row('analyzed', 'studio_row_analyzed', analyzed),
      row('two_way', 'studio_row_two_way', two),
      row('three_way', 'studio_row_three_way', three),
      row('multi_cornered', 'studio_row_multi_cornered', multi),
      row('spoiler_affected', 'studio_row_spoiler_affected', [...affected]),
    ],
  });
  return out;
}
