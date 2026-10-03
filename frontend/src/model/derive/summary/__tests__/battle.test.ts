import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { makeCtx, seat } from './fixtures';

const run = (over = {}) => deriveLayerSummary('battle', makeCtx(over)).sections.filter(s => s.id !== 'key_stats');

describe('battle summary', () => {
  it('sections in the binding order', () => {
    expect(run().map(s => s.id)).toEqual(['margin_dist', 'closest']);
  });

  it('margin_dist: grouped bar with one series per bloc over the VS buckets', () => {
    const c = run()[0].chart!;
    expect(c.type).toBe('groupedBar');
    expect(c.series.map(s => [s.id, s.points.map(p => p.y)])).toEqual([['NDA', [1, 0, 1, 0, 1]], ['MGB', [1, 1, 0, 0, 0]]]);
    expect(c.series[0].points.map(p => p.x)).toEqual(['< 1K', '1–5K', '5–15K', '15–50K', '50K+']);
    expect(c.series[0].color).toBe('#FF7A1A');
  });

  it('margin_dist is titled with the two blocs so it is not confused with the map footer\'s all-seat distribution', () => {
    expect(run()[0]).toMatchObject({ titleKey: 'studio_sum_margin_dist_blocs', titleParams: { a: 'NDA', b: 'MGB' } });
  });

  it('margin_dist (R36): plain rows per bucket - total plus one column per bloc', () => {
    const s = run()[0];
    expect(s.columnsKeys).toEqual(['studio_col_total', 'NDA', 'MGB']);
    expect(s.rows.map(r => [r.label, r.value, r.extra!.map(e => e.value)])).toEqual([
      ['< 1K', 2, [1, 1]], ['1–5K', 1, [0, 1]], ['5–15K', 1, [1, 0]], ['15–50K', 0, [0, 0]], ['50K+', 1, [1, 0]],
    ]);
    expect(s.rows[0].seatIds!.sort()).toEqual(['A', 'E']);
  });

  it('closest: the blocs\' closest seats, legacy top 5', () => {
    // BattleSection.tsx:108-111 — sorted by margin, sliced to 5.
    expect(run()[1].rows.map(r => [r.label, r.value, r.sub])).toEqual([['E', 400, 'MGB'], ['A', 800, 'NDA'], ['C', 3000, 'MGB'], ['B', 12000, 'NDA'], ['D', 60000, 'NDA']]);
  });

  it('closest uses the rankSeats pool: a tiny-margin LEADING seat is skipped once any seat is WON', () => {
    const seats = [seat('A', 'BJP', 800), seat('B', 'RJD', 3000), seat('L', 'BJP', 5, 'GEN', undefined, 'LEADING')];
    expect(run({ seats })[1].rows.map(r => r.label)).toEqual(['A', 'B']);
  });

  it('uses the top two parties when there are no alliances', () => {
    const c = run({ alliances: [] })[0].chart!;
    expect(c.series.map(x => x.id)).toEqual(['BJP', 'RJD']);
  });

  it('no leaders -> no sections', () => {
    expect(run({ seats: [seat('F', '', undefined)] })).toEqual([]);
  });
});
