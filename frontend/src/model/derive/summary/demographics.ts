import { avg, compact, groupsFor, int, ledSeats } from './shared';
import type { ChartSpec, ChartValueFormat, SummaryContext, SummaryRow, SummarySection } from './types';

const CATS = ['GEN', 'SC', 'ST'] as const;
type Cat = typeof CATS[number];

/** DemographicsSection.tsx:13-22,34-76 — seat categories overall and per alliance (party when there are no alliances). */
export function demographicsSummary(ctx: SummaryContext): SummarySection[] {
  // Legacy counted every seat of the election (declared or not); anything that is not SC/ST is general.
  const declared = ctx.seats;
  if (declared.length === 0) return [];
  const totals: Record<Cat, string[]> = { GEN: [], SC: [], ST: [] };
  declared.forEach(s => totals[s.type === 'SC' || s.type === 'ST' ? s.type : 'GEN'].push(s.id));
  const maxTotal = Math.max(...CATS.map(c => totals[c].length), 1);
  const out: SummarySection[] = [{
    id: 'category_breakdown', titleKey: 'studio_sum_category_breakdown',
    rows: CATS.map(c => ({
      id: `cat:${c}`, label: c, labelKey: `studio_col_${c.toLowerCase()}`, value: totals[c].length, valueFormat: 'int' as const,
      seatIds: totals[c], bar: { value: totals[c].length, max: maxTotal, color: 'var(--color-accent)' },
    })),
  }];

  const led = ledSeats(ctx);
  const per = groupsFor(ctx, led).map(g => {
    const own = led.filter(s => g.partyIds.includes(s.party));
    const cat = { GEN: { n: 0, sum: 0 }, SC: { n: 0, sum: 0 }, ST: { n: 0, sum: 0 } };
    own.forEach(s => { const c = cat[s.type === 'SC' || s.type === 'ST' ? s.type : 'GEN']; c.n++; c.sum += s.margin!; });
    return { g, own, cat };
  }).filter(x => x.own.length > 0).sort((a, b) => b.own.length - a.own.length);
  if (per.length === 0) return out;

  // One bar per bloc inside each GEN / SC / ST group; the legend reads "NDA (202)" (name + seats led).
  const chart = (value: (x: typeof per[number], c: Cat) => number | null, valueFormat: ChartValueFormat): ChartSpec => ({
    type: 'groupedBar', xKey: 'category', valueFormat,
    series: per.map(x => ({
      id: x.g.id, label: `${x.g.name} (${x.own.length})`, color: x.g.color,
      points: CATS.flatMap(c => { const y = value(x, c); return y == null ? [] : [{ x: c as string, y }]; }),
    })),
  });
  const rowBase = (x: typeof per[number]) => ({ id: `bloc:${x.g.id}`, label: x.g.name, color: x.g.color, partyIds: x.g.partyIds, seatIds: x.own.map(s => s.id) });
  // "Win rate by category" is a count of seats won per category, as in the legacy chart.
  out.push({
    id: 'win_rate_by_category', titleKey: 'studio_sum_win_rate_by_category', columnsKeys: ['studio_col_total', 'studio_col_gen', 'studio_col_sc', 'studio_col_st'],
    rows: per.map((x): SummaryRow => ({ ...rowBase(x), value: x.own.length, valueFormat: 'int', extra: CATS.map(c => int(x.cat[c].n)) })),
    chart: chart((x, c) => x.cat[c].n, 'int'),
  });
  out.push({
    id: 'margin_by_category', titleKey: 'studio_sum_margin_by_category', columnsKeys: ['studio_col_gen', 'studio_col_sc', 'studio_col_st'],
    // Legacy showed 0 for a category without seats; null renders "—" instead.
    rows: per.map((x): SummaryRow => ({
      ...rowBase(x), value: avg(x.cat.GEN.sum, x.cat.GEN.n), valueFormat: 'compact',
      extra: [compact(avg(x.cat.SC.sum, x.cat.SC.n)), compact(avg(x.cat.ST.sum, x.cat.ST.n))],
    })),
    chart: chart((x, c) => avg(x.cat[c].sum, x.cat[c].n), 'compact'),
  });
  return out;
}
