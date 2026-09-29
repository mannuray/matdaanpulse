import { deriveScoreboard } from '../scoreboard';
import { rankSeats } from '../stats';
import { CLOSE_THRESHOLD } from '../layerInsights';
import { avg, bucketIndex, buckets, compact, int, ledSeats, refRow } from './shared';
import type { SummaryContext, SummarySection } from './types';

const CLOSEST_LIMIT = 5;

/**
 * BattleSection.tsx: the legacy compared the user's selected alliances; the studio compares the two scoreboard
 * blocs (top two alliances, or top two parties when the manifest has no alliances).
 */
export function battleSummary(ctx: SummaryContext): SummarySection[] {
  const blocs = deriveScoreboard(ctx.alliances, ctx.parties, ctx.votePct, 0, 0).blocs.map(b => ({
    ...b,
    partyIds: b.kind === 'alliance' ? ctx.alliances.find(a => a.id === b.id)?.parties ?? [] : [b.id],
  }));
  const led = ledSeats(ctx);
  if (blocs.length === 0 || led.length === 0) return [];
  const blocOf = (party: string) => blocs.find(b => b.partyIds.includes(party));
  const seats = led.filter(s => blocOf(s.party));
  if (seats.length === 0) return [];
  const threshold = CLOSE_THRESHOLD[ctx.electionType];
  const b = buckets(ctx);

  // BattleSection.tsx:71-93 — seats, close wins (< threshold) and average margin per bloc.
  const summary: SummarySection = {
    id: 'seat_summary', titleKey: 'studio_sum_seat_summary',
    columnsKeys: ['studio_col_seats', 'studio_col_close', 'studio_col_avg_margin'],
    rows: blocs.map(bloc => {
      const own = seats.filter(s => blocOf(s.party)?.id === bloc.id);
      const sum = own.reduce((n, s) => n + s.margin!, 0);
      return {
        id: `bloc:${bloc.id}`, label: bloc.name, value: own.length, valueFormat: 'int' as const,
        // Legacy showed 0 for a bloc without seats; null renders "—" instead of an invented 0.
        extra: [int(own.filter(s => s.margin! < threshold).length), compact(avg(sum, own.length))],
        color: bloc.color, seatIds: own.map(s => s.id), partyIds: bloc.partyIds,
      };
    }),
  };

  // BattleSection.tsx:39-57 — margin histogram grouped by bloc.
  const counts = blocs.map(bloc => {
    const c = b.map(() => 0);
    seats.forEach(s => { if (blocOf(s.party)?.id === bloc.id) c[bucketIndex(s.margin!, b)]++; });
    return c;
  });
  const dist: SummarySection = {
    id: 'margin_dist', titleKey: 'studio_sum_margin_dist_blocs', titleParams: { a: blocs[0].id, b: blocs[1]?.id ?? '' },
    // R36: the chart's data as plain rows too (bucket, total, then one column per bloc) so the compact tab can show it.
    columnsKeys: ['studio_col_total', ...blocs.map(bloc => bloc.name)],
    rows: b.map((x, bi) => {
      const total = counts.reduce((n, c) => n + c[bi], 0);
      return {
        id: `bucket:${bi}`, label: x.label, value: total, valueFormat: 'int' as const,
        extra: counts.map(c => int(c[bi])),
        seatIds: seats.filter(s => bucketIndex(s.margin!, b) === bi).map(s => s.id),
      };
    }),
    chart: {
      type: 'groupedBar', xKey: 'bucket', yKey: 'seats',
      series: blocs.map((bloc, i) => ({ id: bloc.id, label: bloc.name, color: bloc.color, points: b.map((x, bi) => ({ x: x.label, y: counts[i][bi] })) })),
    },
  };

  // BattleSection.tsx:96-117 — closest contests among the blocs' seats (top 5, same WON-first pool as the stat tiles).
  const closest: SummarySection = {
    id: 'closest', titleKey: 'studio_sum_closest',
    rows: rankSeats(seats, 'closest', CLOSEST_LIMIT).map(r => refRow(r, blocOf(r.party)!.color, blocOf(r.party)!.name)),
  };
  // Legacy order: margin distribution, seat summary, closest contests.
  return [dist, summary, closest];
}
