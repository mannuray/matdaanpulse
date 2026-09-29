import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { cand, makeCtx } from './fixtures';

const sec = (ctx = makeCtx()) => deriveLayerSummary('overview', ctx).sections;
const byId = (id: string, ctx = makeCtx()) => sec(ctx).find(s => s.id === id)!;

describe('overview summary', () => {
  it('lists sections in the binding order', () => {
    const ctx = makeCtx({ constCandidates: new Map([['c1', [cand('c1', 'BJP', 100), cand('c1', 'RJD', 90)]]]) });
    expect(sec(ctx).map(s => s.id)).toEqual(['vote_vs_seats', 'closest', 'biggest', 'margin_dist', 'wasted', 'reserved']);
  });

  it('vote_vs_seats: seat %, vote % and disparity per alliance, others, then parties', () => {
    // Legacy OverviewSection.tsx:173-174: seatPct = seats / led seats * 100, disparity = seatPct - votePct.
    // 6 led seats: NDA (A,B,D) = 3 -> 50.0 vs vote 30+20 = 50 -> 0.0; MGB (C,E) = 2 -> 33.3 vs 25+5 = 30 -> +3.3;
    // others (G) = 1 -> 16.7 vs AIMIM 3 + IND 4 = 7 -> +9.7 (OverviewSection.tsx:176-180).
    const rows = byId('vote_vs_seats').rows;
    const flat = rows.map(r => [r.id, r.value, r.extra!.map(e => e.value)]);
    expect(flat.slice(0, 3)).toEqual([
      ['alliance:NDA', 3, [50, 50, 0]],
      ['alliance:MGB', 2, [33.3, 30, 3.3]],
      ['others', 1, [16.7, 7, 9.7]],
    ]);
    expect(rows[2].labelKey).toBe('others');
    // Party rows (OverviewSection.tsx:192-196): seats > 0 or vote >= 1, sorted by vote share desc.
    expect(rows.slice(3).map(r => [r.id, r.value, r.extra![1].value])).toEqual([
      ['party:BJP', 2, 30], ['party:RJD', 2, 25], ['party:JDU', 1, 20], ['party:INC', 0, 5], ['party:IND', 0, 4], ['party:AIMIM', 1, 3],
    ]);
    expect(byId('vote_vs_seats').columnsKeys).toEqual(['studio_col_seats', 'studio_col_seat_pct', 'studio_col_vote_pct', 'studio_col_disparity']);
  });

  it('vote_vs_seats is omitted without alliances (legacy needed standings groups)', () => {
    expect(sec(makeCtx({ alliances: [] })).map(s => s.id)).not.toContain('vote_vs_seats');
  });

  it('closest / biggest: led seats ordered by margin, party as sub text', () => {
    expect(byId('closest').rows.map(r => [r.label, r.value])).toEqual([['E', 400], ['A', 800], ['C', 3000], ['B', 12000], ['G', 30000], ['D', 60000]]);
    expect(byId('closest').rows[0]).toMatchObject({ sub: 'RJD', color: '#7BD34A', seatIds: ['E'], partyIds: ['RJD'] });
    expect(byId('biggest').rows.map(r => r.label)).toEqual(['D', 'G', 'B', 'C', 'A', 'E']);
  });

  it('closest / biggest are capped at 10', () => {
    const seats = Array.from({ length: 14 }, (_, i) => ({ id: `S${i}`, name: `S${i}`, party: 'BJP', margin: 100 * (i + 1), status: 'WON', type: 'GEN' as const }));
    expect(byId('closest', makeCtx({ seats })).rows).toHaveLength(10);
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
    expect(rows.map(r => [r.id, r.value, r.extra?.map(e => e.value) ?? null])).toEqual([
      ['alliance:MGB', 52.9, [170, 90]], ['alliance:NDA', 41.2, [170, 70]], ['efficiency_gap', 11.8, null],
    ]);
    expect(rows[2]).toMatchObject({ sub: 'NDA', labelKey: 'studio_row_efficiency_gap' });
  });

  it('wasted is omitted without candidates or alliances', () => {
    expect(sec().map(s => s.id)).not.toContain('wasted');
  });

  it('reserved: SC/ST seats per leading party; pending reserved seats count under IND as the legacy did', () => {
    // OverviewSection.tsx:55-66. B(SC,BJP) C(ST,RJD) E(SC,RJD) H(SC,pending -> 'IND'); sorted by total, stable.
    const rows = byId('reserved').rows;
    expect(rows.map(r => [r.id, r.value, r.extra!.map(e => e.value)])).toEqual([
      ['party:RJD', 2, [1, 1]], ['party:BJP', 1, [1, 0]], ['party:IND', 1, [1, 0]],
    ]);
    expect(byId('reserved').columnsKeys).toEqual(['studio_col_total', 'studio_col_sc', 'studio_col_st']);
  });

  it('a layer without leaders keeps only what has data', () => {
    const ctx = makeCtx({ seats: [], votePct: new Map() });
    expect(sec(ctx)).toEqual([]);
  });
});
