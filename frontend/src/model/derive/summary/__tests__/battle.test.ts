import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { makeCtx, seat } from './fixtures';

const run = (over = {}) => deriveLayerSummary('battle', makeCtx(over)).sections;

describe('battle summary', () => {
  it('sections in the binding order', () => {
    expect(run().map(s => s.id)).toEqual(['seat_summary', 'margin_dist', 'closest']);
  });

  it('seat_summary: seats, avg margin and close seats (< 1K in a VS) for the top two alliances', () => {
    // Legacy BattleSection.tsx:77-91. NDA = A 800, B 12000, D 60000 -> avg round(72800/3) = 24267, close 1.
    // MGB = C 3000, E 400 -> avg 1700, close 1. G (AIMIM) is in neither bloc.
    const s = run()[0];
    expect(s.columnsKeys).toEqual(['studio_col_seats', 'studio_col_avg_margin', 'studio_col_close']);
    expect(s.rows.map(r => [r.label, r.value, r.extra!.map(e => e.value)])).toEqual([['NDA', 3, [24267, 1]], ['MGB', 2, [1700, 1]]]);
    expect(s.rows[0]).toMatchObject({ color: '#FF7A1A', partyIds: ['BJP', 'JDU'], seatIds: ['A', 'B', 'D'] });
  });

  it('margin_dist: grouped bar with one series per bloc over the VS buckets', () => {
    const c = run()[1].chart!;
    expect(c.type).toBe('groupedBar');
    expect(c.series.map(s => [s.id, s.points.map(p => p.y)])).toEqual([['NDA', [1, 0, 1, 0, 1]], ['MGB', [1, 1, 0, 0, 0]]]);
    expect(c.series[0].points.map(p => p.x)).toEqual(['< 1K', '1–5K', '5–15K', '15–50K', '50K+']);
    expect(c.series[0].color).toBe('#FF7A1A');
  });

  it('closest: the blocs\' closest seats, legacy top 5', () => {
    // BattleSection.tsx:108-111 — sorted by margin, sliced to 5.
    expect(run()[2].rows.map(r => [r.label, r.value, r.sub])).toEqual([['E', 400, 'MGB'], ['A', 800, 'NDA'], ['C', 3000, 'MGB'], ['B', 12000, 'NDA'], ['D', 60000, 'NDA']]);
  });

  it('closest uses the rankSeats pool: a tiny-margin LEADING seat is skipped once any seat is WON', () => {
    const seats = [seat('A', 'BJP', 800), seat('B', 'RJD', 3000), seat('L', 'BJP', 5, 'GEN', undefined, 'LEADING')];
    expect(run({ seats })[2].rows.map(r => r.label)).toEqual(['A', 'B']);
  });

  it('uses the top two parties when there are no alliances', () => {
    const s = run({ alliances: [] })[0];
    expect(s.rows.map(r => [r.id, r.value])).toEqual([['bloc:BJP', 2], ['bloc:RJD', 2]]);
  });

  it('a bloc without seats gets "—" (null), not an invented average', () => {
    const only = [seat('A', 'BJP', 800), seat('B', 'JDU', 5000)];
    const s = run({ seats: only })[0];
    expect(s.rows[1]).toMatchObject({ label: 'MGB', value: 0 });
    expect(s.rows[1].extra).toEqual([{ value: null, format: 'int' }, { value: 0, format: 'int' }]);
  });

  it('no leaders -> no sections', () => {
    expect(run({ seats: [seat('F', '', undefined)] })).toEqual([]);
  });
});
