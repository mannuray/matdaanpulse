import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { formatSummaryValue } from '../format';
import { cand, makeCtx, seat } from './fixtures';

const sec = (ctx = makeCtx()) => deriveLayerSummary('overview', ctx).sections;
const byId = (id: string, ctx = makeCtx()) => sec(ctx).find(s => s.id === id)!;

describe('overview summary', () => {
  it('lists sections in the binding order', () => {
    const ctx = makeCtx({ constCandidates: new Map([['c1', [cand('c1', 'BJP', 100), cand('c1', 'RJD', 90)]]]) });
    expect(sec(ctx).map(s => s.id)).toEqual(['key_stats', 'margin_dist', 'closest', 'biggest', 'reserved', 'vote_vs_seats_alliances', 'vote_vs_seats_parties', 'wasted']);
  });

  it('key_stats: declared (WON) seats, average and median margin over every seat with a leader', () => {
    // ElectionSummary.tsx: margins A 800, B 12000, C 3000, D 60000, E 400, G 30000 -> avg round(106200 / 6) = 17700, median (3000 + 12000) / 2 = 7500.
    const s = byId('key_stats');
    expect(s).toMatchObject({ layout: 'stats', titleKey: '' });
    expect(s.rows.map(r => [r.id, r.labelKey, r.value, r.valueFormat])).toEqual([
      ['declared', 'seats_declared', 6, 'int'], ['avg_margin', 'avg_margin', 17700, 'compact'], ['median', 'median_margin', 7500, 'compact'],
    ]);
    // A LEADING seat counts towards the margins but not towards Declared.
    const live = byId('key_stats', makeCtx({ seats: [seat('W', 'BJP', 100), seat('L', 'RJD', 300, 'GEN', undefined, 'LEADING'), seat('P', '', undefined)] }));
    expect(live.rows.map(r => r.value)).toEqual([1, 200, 200]);
  });

  it('vote_vs_seats_alliances: difference, vote % and seat % per alliance, others last', () => {
    // Legacy OverviewSection.tsx:173-174: seatPct = seats / led seats * 100, disparity = seatPct - votePct.
    // 6 led seats: NDA (A,B,D) = 3 -> 50.0 vs vote 30+20 = 50 -> 0.0; MGB (C,E) = 2 -> 33.3 vs 25+5 = 30 -> +3.3;
    // others (G) = 1 -> 16.7 vs AIMIM 3 + IND 4 = 7 -> +9.7 (OverviewSection.tsx:176-180). Sorted by seat % desc.
    const s = byId('vote_vs_seats_alliances');
    expect(s.columnsKeys).toEqual(['studio_col_disparity', 'studio_col_vote_pct', 'studio_col_seat_pct']);
    expect(s.primaryCol).toBe(2);
    expect(s.rows.map(r => [r.id, r.value, r.extra!.map(e => e.value)])).toEqual([
      ['alliance:NDA', 0, [50, 50]], ['alliance:MGB', 3.3, [30, 33.3]], ['others', 9.7, [7, 16.7]],
    ]);
    expect(s.rows[0].valueFormat).toBe('signed1');
    expect(s.rows[2].labelKey).toBe('others');
  });

  it('vote_vs_seats_alliances: the difference is taken from the rounded seat % and vote % (matches the baseline)', () => {
    // MGB: seat 2/6 = 33.333 -> 33.3, vote 31.96 -> 32.0; rounded difference +1.3 (the raw one would round to +1.4).
    const ctx = makeCtx({ votePct: new Map([['BJP', 30], ['JDU', 20], ['RJD', 31.96], ['AIMIM', 3], ['IND', 4]]) });
    const mgb = byId('vote_vs_seats_alliances', ctx).rows.find(r => r.id === 'alliance:MGB')!;
    expect(mgb.extra!.map(e => e.value)).toEqual([32, 33.3]);
    expect(mgb.value).toBe(1.3);
  });

  it('vote_vs_seats_alliances chart: vote % (opacity .4) and seat % bars per alliance, difference annotated', () => {
    // OverviewSection.tsx:173-174 disparity = seatPct - votePct, drawn above each alliance's vote / seat bar pair.
    const s = byId('vote_vs_seats_alliances');
    expect(s.chartLabelKey).toBe('studio_tab_alliances');
    const c = s.chart!;
    expect(c.type).toBe('groupedBar');
    expect(c.valueFormat).toBe('pct');
    expect(c.series.map(x => [x.id, x.labelKey, x.opacity])) .toEqual([['vote', 'studio_col_vote_pct', 0.4], ['seat', 'studio_col_seat_pct', undefined]]);
    const colours = s.rows.map(r => r.color);
    expect(c.series[0].points.map(p => [p.x, p.y, p.color])).toEqual([['NDA', 50, colours[0]], ['MGB', 30, colours[1]], ['others', 7, colours[2]]]);
    expect(c.series[1].points.map(p => [p.x, p.y, p.color])).toEqual([['NDA', 50, colours[0]], ['MGB', 33.3, colours[1]], ['others', 16.7, colours[2]]]);
    // No English fallback in the model: the series are named by key only; the Others group is translated through its labelKey.
    expect(c.series.every(x => x.label === undefined)).toBe(true);
    expect(c.series[0].points[2]).toMatchObject({ x: 'others', labelKey: 'others' });
    expect(c.annotations).toEqual([{ x: 'NDA', text: '0.0', tone: 'neutral' }, { x: 'MGB', text: '+3.3', tone: 'up' }, { x: 'others', text: '+9.7', tone: 'up' }]);
  });

  it('vote_vs_seats_alliances chartAlt: parties by seats, short ids as x, full names as labels, negative difference is down', () => {
    // Party rows (OverviewSection.tsx:192-196): BJP 33.3 vs 30, RJD 33.3 vs 25, JDU 16.7 vs 20, AIMIM 16.7 vs 3, INC 0 vs 5, IND 0 vs 4.
    const alt = byId('vote_vs_seats_alliances').chartAlt!;
    expect(alt.labelKey).toBe('studio_tab_parties');
    expect(alt.titleKey).toBe('studio_sum_vote_vs_seats_parties');
    expect(alt.spec.series[1].points.map(p => [p.x, p.label, p.y])).toEqual([
      ['BJP', 'Bharatiya Janata Party', 33.3], ['RJD', 'Rashtriya Janata Dal', 33.3], ['JDU', 'Janata Dal (United)', 16.7], ['AIMIM', 'AIMIM', 16.7],
      ['INC', 'Indian National Congress', 0], ['IND', 'IND', 0],
    ]);
    expect(alt.spec.annotations!.find(a => a.x === 'JDU')).toEqual({ x: 'JDU', text: '−3.3', tone: 'down' });
    expect(alt.spec.valueFormat).toBe('pct');
  });

  it('chartAlt ranks by seats won, not vote share: small seat winners beat big vote-getters without seats (max 10)', () => {
    // 12 qualifying parties. W1..W4 win one seat each with 0.5% of the vote (the party list's vote-ranked top 10 would drop them);
    // N1..N8 win nothing with 2..9% of the vote. BJP/JDU/RJD/AIMIM keep their seats. Seats desc, vote desc on ties.
    const small = ['W1', 'W2', 'W3', 'W4'];
    const extra = small.map((id, i) => seat(`X${i}`, id, 100 + i));
    const nothing = Array.from({ length: 8 }, (_, i) => `N${i + 1}`);
    const votePct = new Map<string, number>([['BJP', 30], ['JDU', 20], ['RJD', 25], ['AIMIM', 3], ...small.map(id => [id, 0.5] as [string, number]), ...nothing.map((id, i) => [id, 2 + i] as [string, number])]);
    const ctx = makeCtx({ seats: [...makeCtx().seats, ...extra], votePct, parties: [...makeCtx().parties, ...small.map(id => ({ id, name: id, color: '#999', seats: 1 }))] });
    const alt = byId('vote_vs_seats_alliances', ctx).chartAlt!;
    const xs = alt.spec.series[1].points.map(p => p.x);
    expect(xs).toHaveLength(10);
    // 10 seat winners exist (BJP, RJD, JDU, AIMIM, W1..W4 = 8 with seats; + 2 zero-seat parties by vote: N8, N7)
    expect(xs.slice(0, 8).sort()).toEqual(['AIMIM', 'BJP', 'JDU', 'RJD', 'W1', 'W2', 'W3', 'W4'].sort());
    expect(xs.slice(8)).toEqual(['N8', 'N7']);
    // the party *table* keeps its vote ranking (top 10 by vote share), so W1..W4 are not in it
    expect(byId('vote_vs_seats_parties', ctx).rows.some(r => r.id === 'party:W1')).toBe(false);
  });

  it('vote_vs_seats_parties: seats > 0 or vote >= 1, sorted by vote share desc', () => {
    // Party rows (OverviewSection.tsx:192-196), top 10.
    const s = byId('vote_vs_seats_parties');
    expect(s.rows.map(r => [r.id, r.extra![0].value, r.extra![1].value])).toEqual([
      ['party:BJP', 30, 33.3], ['party:RJD', 25, 33.3], ['party:JDU', 20, 16.7], ['party:INC', 5, 0], ['party:IND', 4, 0], ['party:AIMIM', 3, 16.7],
    ]);
  });

  it('vote_vs_seats sections are omitted without alliances (legacy needed standings groups)', () => {
    const ids = sec(makeCtx({ alliances: [] })).map(s => s.id);
    expect(ids).not.toContain('vote_vs_seats_alliances');
    expect(ids).not.toContain('vote_vs_seats_parties');
  });

  it('closest / biggest: led seats ordered by margin, party as sub text', () => {
    expect(byId('closest').rows.map(r => [r.label, r.value])).toEqual([['E', 400], ['A', 800], ['C', 3000], ['B', 12000], ['G', 30000], ['D', 60000]]);
    expect(byId('closest').titleKey).toBe('studio_sum_closest_battles');
    expect(byId('closest').rows[0].valueFormat).toBe('compact');
    expect(byId('closest').rows[0]).toMatchObject({ sub: 'RJD', color: '#7BD34A', seatIds: ['E'], partyIds: ['RJD'] });
    // Legacy: the 5 biggest mandates.
    expect(byId('biggest').rows.map(r => r.label)).toEqual(['D', 'G', 'B', 'C', 'A']);
  });

  it('closest is capped at 10 and biggest at 5', () => {
    const seats = Array.from({ length: 14 }, (_, i) => ({ id: `S${i}`, name: `S${i}`, party: 'BJP', margin: 100 * (i + 1), status: 'WON', type: 'GEN' as const }));
    expect(byId('closest', makeCtx({ seats })).rows).toHaveLength(10);
    expect(byId('biggest', makeCtx({ seats })).rows).toHaveLength(5);
    expect(byId('biggest', makeCtx({ seats })).rows[0].label).toBe('S13');
  });

  it('margin_dist: VS buckets, bar chart', () => {
    // Legacy bucket rule (OverviewSection.tsx:32): first bucket with margin < max, last catches the rest.
    const s = byId('margin_dist');
    expect(s.rows.map(r => [r.label, r.value])).toEqual([['< 1K', 2], ['1–5K', 1], ['5–15K', 1], ['15–50K', 1], ['50K+', 1]]);
    expect(s.rows[0].seatIds).toEqual(['A', 'E']);
    expect(s.chart!.type).toBe('bar');
    expect(s.chart!.series).toHaveLength(1);
    expect(s.chart!.series[0].points).toEqual([{ x: '< 1K', y: 2 }, { x: '1–5K', y: 1 }, { x: '5–15K', y: 1 }, { x: '15–50K', y: 1 }, { x: '50K+', y: 1 }]);
  });

  it('wasted: votes for an alliance in seats another alliance won, plus the efficiency gap', () => {
    // Legacy OverviewSection.tsx:261-274. c1 winner NDA: NDA 100, MGB 90 (wasted), AIMIM ignored (no alliance).
    // c2 winner MGB: MGB 80, NDA 70 (wasted). NDA 70/170 = 41.2%, MGB 90/170 = 52.9%.
    // Equal totals -> byTotal keeps [MGB, NDA]; diff = 52.94 - 41.18 > 0 -> NDA has the +11.8pp advantage.
    const ctx = makeCtx({ constCandidates: new Map([
      ['c1', [cand('c1', 'BJP', 100), cand('c1', 'RJD', 90), cand('c1', 'AIMIM', 20)]],
      ['c2', [cand('c2', 'RJD', 80), cand('c2', 'JDU', 70)]],
    ]) });
    const rows = byId('wasted', ctx).rows;
    // Legacy columns: Total, Wasted, % (the compact card shows the %); vote totals in lakh.
    expect(byId('wasted', ctx).columnsKeys).toEqual(['studio_col_total', 'studio_col_wasted', 'studio_col_wasted_pct']);
    expect(rows.map(r => [r.id, r.value, r.valueFormat, r.extra?.map(e => e.value) ?? null])).toEqual([
      ['alliance:MGB', 170, 'lakh', [90, 52.9]], ['alliance:NDA', 170, 'lakh', [70, 41.2]], ['efficiency_gap', null, 'text', [null, 11.8]],
    ]);
    expect(rows[2]).toMatchObject({ sub: 'NDA', labelKey: 'studio_row_efficiency_gap' });
    expect(rows[2].extra![1].format).toBe('pp');
    // Cells that do not apply (total, wasted) render blank, not "— —".
    expect(formatSummaryValue(rows[2].value, rows[2].valueFormat, { text: rows[2].valueText })).toBe('');
    expect(formatSummaryValue(rows[2].extra![0].value, rows[2].extra![0].format, { text: rows[2].extra![0].text })).toBe('');
    expect(byId('wasted', ctx).primaryCol).toBe(2);
  });

  it('wasted is omitted without candidates or alliances', () => {
    expect(sec().map(s => s.id)).not.toContain('wasted');
  });

  it('reserved: SC/ST seats per leading party; pending reserved seats are excluded', () => {
    // OverviewSection.tsx:55-66. B(SC,BJP) C(ST,RJD) E(SC,RJD); H (SC, pending, no leader) is not bucketed as 'IND'.
    const rows = byId('reserved').rows;
    expect(rows.map(r => [r.id, r.value, r.extra!.map(e => e.value)])).toEqual([
      ['party:RJD', 1, [1, 2]], ['party:BJP', 1, [0, 1]],
    ]);
    // Legacy columns: SC, ST, Total, with "–" for a zero SC / ST count.
    // Legacy labelled rows with the party id.
    expect(rows.map(r => [r.label, r.sub])).toEqual([['RJD', 'Rashtriya Janata Dal'], ['BJP', 'Bharatiya Janata Party']]);
    expect(byId('reserved').columnsKeys).toEqual(['studio_col_sc', 'studio_col_st', 'studio_col_total']);
    expect(byId('reserved').primaryCol).toBe(2);
    expect(rows[1].valueFormat).toBe('intDash');
    expect(rows[1].extra![0].format).toBe('intDash');
  });

  it('closest / biggest follow rankSeats: WON seats only once any seat is WON', () => {
    const seats = [
      seat('W1', 'BJP', 5000), seat('W2', 'RJD', 9000), seat('W3', 'JDU', 1200),
      seat('L1', 'BJP', 10, 'GEN', undefined, 'LEADING'), seat('L2', 'RJD', 999999, 'GEN', undefined, 'LEADING'),
    ];
    const ctx = makeCtx({ seats });
    expect(byId('closest', ctx).rows.map(r => r.label)).toEqual(['W3', 'W1', 'W2']);
    expect(byId('biggest', ctx).rows.map(r => r.label)).toEqual(['W2', 'W1', 'W3']);
    // Nothing WON yet: the LEADING seats are the pool.
    const live = makeCtx({ seats: seats.filter(s => s.status === 'LEADING') });
    expect(byId('closest', live).rows.map(r => r.label)).toEqual(['L1', 'L2']);
  });

  it('a layer without leaders keeps only what has data', () => {
    const ctx = makeCtx({ seats: [], votePct: new Map() });
    expect(sec(ctx)).toEqual([]);
  });
});
