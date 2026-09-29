import { deriveScoreboard } from '../scoreboard';
import { CLOSE_THRESHOLD } from '../layerInsights';
import { avg, bucketIndex, buckets, int, ledSeats, marginRow } from './shared';
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
    columnsKeys: ['studio_col_seats', 'studio_col_avg_margin', 'studio_col_close'],
    rows: blocs.map(bloc => {
      const own = seats.filter(s => blocOf(s.party)?.id === bloc.id);
      const sum = own.reduce((n, s) => n + s.margin!, 0);
      return {
        id: `bloc:${bloc.id}`, label: bloc.name, value: own.length, valueFormat: 'int' as const,
        // Legacy showed 0 for a bloc without seats; null renders "—" instead of an invented 0.
        extra: [int(avg(sum, own.length)), int(own.filter(s => s.margin! < threshold).length)],
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
    id: 'margin_dist', titleKey: 'studio_sum_margin_dist', rows: [],
    chart: {
      type: 'groupedBar', xKey: 'bucket', yKey: 'seats',
      series: blocs.map((bloc, i) => ({ id: bloc.id, label: bloc.name, color: bloc.color, points: b.map((x, bi) => ({ x: x.label, y: counts[i][bi] })) })),
    },
  };

  // BattleSection.tsx:96-117 — closest contests among the blocs' seats (legacy top 5).
  const closest: SummarySection = {
    id: 'closest', titleKey: 'studio_sum_closest',
    rows: [...seats].sort((a, c) => a.margin! - c.margin!).slice(0, CLOSEST_LIMIT)
      .map(s => marginRow(`seat:${s.id}`, s, blocOf(s.party)!.color, blocOf(s.party)!.name)),
  };
  return [summary, dist, closest];
}
