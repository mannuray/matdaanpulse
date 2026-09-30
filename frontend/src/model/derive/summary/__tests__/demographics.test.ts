import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { makeCtx } from './fixtures';

const run = (over = {}) => deriveLayerSummary('demographics', makeCtx(over)).sections.filter(s => s.id !== 'key_stats');
const rows = (id: string, over = {}) => run(over).find(s => s.id === id)!.rows.map(r => [r.label, r.value, r.extra?.map(e => e.value)]);

describe('demographics summary', () => {
  it('sections in the binding order', () => {
    expect(run().map(s => s.id)).toEqual(['category_breakdown', 'win_rate_by_category', 'margin_by_category']);
  });

  it('category_breakdown counts every seat: GEN 4 (A, D, F, G), SC 3 (B, E, H), ST 1 (C)', () => {
    // DemographicsSection.tsx:16-20 — everything that is not SC/ST is GEN; the legacy counted all regions, declared or not.
    expect(rows('category_breakdown')).toEqual([['GEN', 4, undefined], ['SC', 3, undefined], ['ST', 1, undefined]]);
    expect(run()[0].rows[1]).toMatchObject({ labelKey: 'studio_col_sc', bar: { value: 3, max: 4 } });
  });

  it('win_rate_by_category: seats won per category per alliance', () => {
    // DemographicsSection.tsx:37-48: NDA = A GEN, B SC, D GEN; MGB = C ST, E SC. AIMIM has no alliance -> skipped.
    expect(rows('win_rate_by_category')).toEqual([['NDA', 3, [2, 1, 0]], ['MGB', 2, [0, 1, 1]]]);
    expect(run()[1].columnsKeys).toEqual(['studio_col_total', 'studio_col_gen', 'studio_col_sc', 'studio_col_st']);
  });

  it('margin_by_category: average margin, null where the bloc has no seat in a category', () => {
    // DemographicsSection.tsx:64,71-73: NDA GEN (800 + 60000) / 2 = 30400, SC 12000, ST none (legacy 0 -> null here).
    expect(rows('margin_by_category')).toEqual([['NDA', 30400, [12000, null]], ['MGB', null, [400, 3000]]]);
    expect(run().find(s => s.id === 'margin_by_category')!.rows[0].valueFormat).toBe('compact');
  });

  it('win_rate_by_category chart: GEN / SC / ST groups, one bar per alliance in its colour, legend carries the total', () => {
    // DemographicsSection.tsx es-vbar over allianceCategoryWins (entry[cat]++): NDA GEN 2 / SC 1 / ST 0, MGB GEN 0 / SC 1 / ST 1.
    const c = run().find(s => s.id === 'win_rate_by_category')!.chart!;
    expect(c.type).toBe('groupedBar');
    expect(c.valueFormat).toBe('int');
    expect(c.series.map(s => [s.id, s.label, s.points.map(p => [p.x, p.y])])).toEqual([
      ['NDA', 'NDA (3)', [['GEN', 2], ['SC', 1], ['ST', 0]]],
      ['MGB', 'MGB (2)', [['GEN', 0], ['SC', 1], ['ST', 1]]],
    ]);
    expect(c.series[0].color).toBe(run().find(s => s.id === 'win_rate_by_category')!.rows[0].color);
  });

  it('margin_by_category chart: average margin per category, compact labels, no bar where the bloc has no seat', () => {
    // DemographicsSection.tsx:64,71-73 (Math.round(sum / n)): NDA GEN 30400, SC 12000, ST none; MGB GEN none, SC 400, ST 3000.
    const c = run().find(s => s.id === 'margin_by_category')!.chart!;
    expect(c.type).toBe('groupedBar');
    expect(c.valueFormat).toBe('compact');
    expect(c.series.map(s => [s.label, s.points.map(p => [p.x, p.y])])).toEqual([
      ['NDA (3)', [['GEN', 30400], ['SC', 12000]]],
      ['MGB (2)', [['SC', 400], ['ST', 3000]]],
    ]);
  });

  it('groups by party when the manifest has no alliances', () => {
    expect(rows('win_rate_by_category', { alliances: [] }).map(r => [r[0], r[1]])).toEqual([['Bharatiya Janata Party', 2], ['Rashtriya Janata Dal', 2], ['Janata Dal (United)', 1], ['AIMIM', 1]]);
  });

  it('a pending-only election still counts its seats by category but has no per-bloc sections', () => {
    expect(run({ seats: [{ id: 'X', name: 'X', party: '', status: 'PENDING', type: 'SC' as const }] }).map(s => s.id)).toEqual(['category_breakdown']);
    expect(run({ seats: [] })).toEqual([]);
  });
});
