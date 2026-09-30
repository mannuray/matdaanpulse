import { FALLBACK_COLOR, colorOf, compact, int, partyName, seatIdsOf, seatLabel, shortName } from './shared';
import { formatCompact } from './format';
import type { SummaryContext, SummaryRow, SummarySection } from './types';

const TREND_PARTIES = 6;
const DEFEATS_LIMIT = 10;
const SWING_SEATS_LIMIT = 15;
const SWITCHERS_LIMIT = 20;

const firstTwoWords = (s: string) => s.split(' ').slice(0, 2).join(' ');

/** HistorySection.tsx:47-86 — seat dominance classes, by party, and the swing seats. */
function dominance(ctx: SummaryContext, seatName: (id: string) => string): SummarySection[] {
  const dom = ctx.dominance;
  if (!dom || dom.size === 0) return [];
  const classes = ['stronghold', 'loyal', 'swing', 'new'] as const;
  const ids = { stronghold: [] as string[], loyal: [] as string[], swing: [] as string[], new: [] as string[] };
  const byParty = new Map<string, { stronghold: string[]; loyal: string[] }>();
  for (const d of dom.values()) {
    const cls = d.classification in ids ? d.classification : 'new';
    ids[cls].push(d.constId);
    if ((cls === 'stronghold' || cls === 'loyal') && d.dominantParty) {
      const e = byParty.get(d.dominantParty) ?? { stronghold: [], loyal: [] };
      e[cls].push(d.constId);
      byParty.set(d.dominantParty, e);
    }
  }
  const out: SummarySection[] = [{
    // Legacy showed Strongholds / Loyal / Swing as three numbers (new seats were only counted, not shown).
    id: 'dominance', titleKey: 'studio_sum_dominance', layout: 'stats',
    rows: classes.filter(c => c !== 'new').map(c => ({ id: `class:${c}`, label: c, labelKey: `studio_chip_${c}`, value: ids[c].length, valueFormat: 'int' as const, seatIds: ids[c] })),
  }];
  if (byParty.size > 0) {
    out.push({
      id: 'dominance_by_party', titleKey: 'studio_sum_dominance_by_party', columnsKeys: ['studio_chip_stronghold', 'studio_chip_loyal', 'studio_col_total'], primaryCol: 2,
      rows: [...byParty.entries()]
        .sort((a, b) => (b[1].stronghold.length + b[1].loyal.length) - (a[1].stronghold.length + a[1].loyal.length))
        .map(([p, e]) => ({
          id: `party:${p}`, label: partyName(ctx, p), value: e.stronghold.length, valueFormat: 'int' as const,
          extra: [int(e.loyal.length), int(e.stronghold.length + e.loyal.length)], color: colorOf(ctx, p), partyIds: [p], seatIds: [...e.stronghold, ...e.loyal],
        })),
    });
  }
  if (ids.swing.length > 0) {
    const seat = new Map(ctx.seats.map(s => [s.id, s]));
    out.push({
      id: 'swing_seats', titleKey: 'studio_sum_swing_seats', titleParams: { count: ids.swing.length }, more: Math.max(0, ids.swing.length - SWING_SEATS_LIMIT),
      rows: ids.swing.slice(0, SWING_SEATS_LIMIT).map(id => {
        const s = seat.get(id);
        const winners = dom.get(id)!.winners.map(w => w.party);
        return {
          id: `seat:${id}`, label: seatName(id), sub: winners.join(' → '), value: s?.margin ?? null, valueFormat: 'compact' as const,
          color: s?.party ? colorOf(ctx, s.party) : FALLBACK_COLOR, seatIds: [id], partyIds: winners,
        };
      }),
    });
  }
  return out;
}

/** HistorySection.tsx:144-224 — incumbency: recontest / win rate, by party, and the notable defeats. */
function incumbency(ctx: SummaryContext, seatName: (id: string) => string): SummarySection[] {
  const inc = ctx.incumbency;
  if (inc.length === 0) return [];
  const total = inc.length;
  const won = inc.filter(e => e.won).length;
  const byParty = new Map<string, { contested: number; won: number }>();
  for (const e of inc) {
    const x = byParty.get(e.incumbentParty) ?? { contested: 0, won: 0 };
    x.contested++;
    if (e.won) x.won++;
    byParty.set(e.incumbentParty, x);
  }
  const row = (id: string, labelKey: string, value: number, valueFormat: 'int' | 'pct0', seatIds?: string[]): SummaryRow => ({ id, label: id, labelKey, value, valueFormat, ...(seatIds ? { seatIds } : {}) });
  const defeats = inc.filter(e => !e.won).sort((a, b) => a.currentMargin - b.currentMargin).slice(0, DEFEATS_LIMIT);
  const out: SummarySection[] = [
    {
      id: 'anti_incumbency', titleKey: 'studio_sum_anti_incumbency', layout: 'stats',
      rows: [
        row('recontested', 'studio_row_recontested', total, 'int', inc.map(e => e.constId)),
        row('won', 'studio_col_won', won, 'int', inc.filter(e => e.won).map(e => e.constId)),
        row('win_rate', 'studio_row_win_rate_short', Math.round((won / total) * 100), 'pct0'),
      ],
    },
    {
      id: 'incumbent_win_rate', titleKey: 'studio_sum_incumbent_win_rate', columnsKeys: ['studio_col_contested', 'studio_col_won', 'studio_col_win_rate'], primaryCol: 2,
      rows: [...byParty.entries()].sort((a, b) => b[1].contested - a[1].contested).map(([p, c]) => ({
        id: `party:${p}`, label: partyName(ctx, p), value: c.contested, valueFormat: 'int' as const,
        extra: [int(c.won), { value: Math.round((c.won / c.contested) * 100), format: 'pct0' as const }], color: colorOf(ctx, p), partyIds: [p], seatIds: seatIdsOf(ctx.seats, [p]),
      })),
    },
  ];
  if (defeats.length > 0) {
    out.push({
      id: 'incumbent_defeats', titleKey: 'studio_sum_incumbent_defeats',
      rows: defeats.map(d => ({
        id: `seat:${d.constId}`, label: seatName(d.constId), sub: firstTwoWords(d.incumbentName), value: d.currentMargin, valueFormat: 'compact' as const,
        color: colorOf(ctx, d.incumbentParty), seatIds: [d.constId], partyIds: [d.incumbentParty],
      })),
    });
  }
  return out;
}

/** HistorySection.tsx:235-259 — party switchers and their directions. */
function switchers(ctx: SummaryContext): SummarySection[] {
  const sw = ctx.partySwitches;
  if (sw.length === 0) return [];
  const won = sw.filter(e => e.wonInNewParty).length;
  const dirs = new Map<string, { from: string; to: string; count: number; won: number; ids: string[] }>();
  for (const e of sw) {
    const k = `${e.fromParty}→${e.toParty}`;
    const d = dirs.get(k) ?? { from: e.fromParty, to: e.toParty, count: 0, won: 0, ids: [] };
    d.count++;
    if (!d.ids.includes(e.constId)) d.ids.push(e.constId);
    if (e.wonInNewParty) d.won++;
    dirs.set(k, d);
  }
  const row = (id: string, labelKey: string, value: number, valueFormat: 'int' | 'pct0', seatIds?: string[]): SummaryRow => ({ id, label: id, labelKey, value, valueFormat, ...(seatIds ? { seatIds } : {}) });
  return [
    {
      id: 'party_switchers', titleKey: 'studio_sum_party_switchers', layout: 'stats',
      rows: [
        row('switchers', 'studio_row_switchers', sw.length, 'int', [...new Set(sw.map(e => e.constId))]),
        row('switchers_won', 'studio_row_switchers_won', won, 'int', [...new Set(sw.filter(e => e.wonInNewParty).map(e => e.constId))]),
        row('success_rate', 'studio_row_success_rate', Math.round((won / sw.length) * 100), 'pct0'),
      ],
    },
    {
      id: 'switch_directions', titleKey: 'studio_sum_switch_directions', columnsKeys: ['studio_col_count', 'studio_col_won'],
      rows: [...dirs.values()].sort((a, b) => b.count - a.count).map(d => ({
        id: `dir:${d.from}→${d.to}`, label: `${d.from} → ${d.to}`, value: d.count, valueFormat: 'int' as const,
        extra: [int(d.won)], color: colorOf(ctx, d.to), partyIds: [d.from, d.to], seatIds: d.ids,
      })),
    },
    {
      // HistorySection.tsx:"Notable Switchers": name, from → to, years, result, margin (first 20; the header counts all).
      id: 'notable_switchers', titleKey: 'studio_sum_notable_switchers', titleParams: { count: sw.length }, more: Math.max(0, sw.length - SWITCHERS_LIMIT),
      columnsKeys: ['studio_col_margin', 'studio_col_result'],
      rows: sw.slice(0, SWITCHERS_LIMIT).map((e, i) => ({
        id: `switcher:${e.constId}:${i}`, label: firstTwoWords(e.candidateName), sub: `${e.fromParty} → ${e.toParty} · ${e.fromYear}→${e.toYear}`,
        value: e.margin, valueFormat: 'compact' as const, extra: [{ value: e.wonInNewParty ? 1 : 0, format: 'result' as const }],
        color: colorOf(ctx, e.toParty), seatIds: [e.constId], partyIds: [e.fromParty, e.toParty],
      })),
    },
  ];
}

/** HistorySection.tsx:327-401 — average margin per election, and seats per party across elections. */
function trends(ctx: SummaryContext): SummarySection[] {
  // Legacy rendered both only when there are at least two elections to compare.
  if (ctx.marginTrend.length <= 1) return [];
  const mt = ctx.marginTrend;
  const max = Math.max(...mt.map(m => m.avgMargin), 1);
  const out: SummarySection[] = [{
    id: 'margin_trend', titleKey: 'studio_sum_margin_trend', columnsKeys: ['studio_col_avg_margin', 'studio_col_median_margin', 'studio_col_seats'],
    rows: mt.map(m => ({
      id: `year:${m.year}`, label: String(m.year), value: m.avgMargin, valueFormat: 'compact' as const,
      extra: [compact(m.medianMargin), int(m.seats)], bar: { value: m.avgMargin, max, color: 'var(--color-accent)' },
    })),
    chart: {
      type: 'line', xKey: 'year', yKey: 'margin',
      series: [
        { id: 'avg', label: 'Average', labelKey: 'studio_col_avg_margin', color: 'var(--color-accent)', points: mt.map(m => ({ x: m.year, y: m.avgMargin })) },
        { id: 'median', label: 'Median', labelKey: 'studio_col_median_margin', color: 'var(--color-map-swing)', points: mt.map(m => ({ x: m.year, y: m.medianMargin })) },
      ],
    },
  }];
  if (ctx.partyTrend.length > 0) {
    const latest = mt[mt.length - 1].year;
    const byParty = new Map<string, Map<number, { seats: number; avg: number }>>();
    for (const p of ctx.partyTrend) {
      if (!byParty.has(p.party)) byParty.set(p.party, new Map());
      byParty.get(p.party)!.set(p.year, { seats: p.seatsWon, avg: p.avgMargin });
    }
    // Legacy: every party seen in at least two elections, sorted by seats in the latest one; cells "seats/avg margin".
    const years = mt.map(m => m.year);
    const parties = [...byParty.entries()]
      .filter(([, y]) => y.size >= 2)
      .map(([party, y]) => ({ party, years: y, latest: y.get(latest)?.seats ?? 0 }))
      .sort((a, b) => b.latest - a.latest);
    if (parties.length > 0) {
      const cell = (y: Map<number, { seats: number; avg: number }>, year: number) => {
        const d = y.get(year);
        return d ? { value: d.seats, format: 'text' as const, text: `${d.seats}/${formatCompact(d.avg)}` } : { value: null, format: 'text' as const, text: '–' };
      };
      out.push({
        id: 'party_trend', titleKey: 'studio_sum_party_trend', columnsKeys: years.map(String), primaryCol: years.length - 1,
        rows: parties.map(p => ({
          id: `party:${p.party}`, label: partyName(ctx, p.party), value: cell(p.years, years[0]).value, valueFormat: 'text' as const, valueText: cell(p.years, years[0]).text,
          extra: years.slice(1).map(y => cell(p.years, y)), color: colorOf(ctx, p.party), partyIds: [p.party], seatIds: seatIdsOf(ctx.seats, [p.party]),
        })),
        chart: {
          type: 'line', xKey: 'year', yKey: 'seats',
          series: parties.slice(0, TREND_PARTIES).map(p => ({
            id: p.party, label: partyName(ctx, p.party), color: colorOf(ctx, p.party),
            points: [...p.years.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y: y.seats })),
          })),
        },
      });
    }
  }
  return out;
}

export function historySummary(ctx: SummaryContext): SummarySection[] {
  const names = new Map(ctx.seats.map(s => [s.id, seatLabel(s.name)]));
  const seatName = (id: string) => names.get(id) ?? shortName(id);
  return [...dominance(ctx, seatName), ...incumbency(ctx, seatName), ...switchers(ctx), ...trends(ctx)];
}
