import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { makeCtx } from './fixtures';

const run = (over = {}) => deriveLayerSummary('demographics', makeCtx(over)).sections;
const rows = (id: string, over = {}) => run(over).find(s => s.id === id)!.rows.map(r => [r.label, r.value, r.extra?.map(e => e.value)]);

describe('demographics summary', () => {
  it('sections in the binding order', () => {
    expect(run().map(s => s.id)).toEqual(['category_breakdown', 'win_rate_by_category', 'margin_by_category']);
  });

  it('category_breakdown counts seats with a leader: GEN 3 (A, D, G), SC 2 (B, E), ST 1 (C); pending F and H excluded', () => {
    // DemographicsSection.tsx:16-20 — everything that is not SC/ST is GEN; pending seats (no leader) are excluded.
    expect(rows('category_breakdown')).toEqual([['GEN', 3, undefined], ['SC', 2, undefined], ['ST', 1, undefined]]);
    expect(run()[0].rows[1]).toMatchObject({ labelKey: 'studio_col_sc', bar: { value: 2, max: 3 } });
  });

  it('win_rate_by_category: seats won per category per alliance', () => {
    // DemographicsSection.tsx:37-48: NDA = A GEN, B SC, D GEN; MGB = C ST, E SC. AIMIM has no alliance -> skipped.
    expect(rows('win_rate_by_category')).toEqual([['NDA', 3, [2, 1, 0]], ['MGB', 2, [0, 1, 1]]]);
    expect(run()[1].columnsKeys).toEqual(['studio_col_total', 'studio_col_gen', 'studio_col_sc', 'studio_col_st']);
  });

  it('margin_by_category: average margin, null where the bloc has no seat in a category', () => {
    // DemographicsSection.tsx:64,71-73: NDA GEN (800 + 60000) / 2 = 30400, SC 12000, ST none (legacy 0 -> null here).
    expect(rows('margin_by_category')).toEqual([['NDA', 30400, [12000, null]], ['MGB', null, [400, 3000]]]);
  });

  it('groups by party when the manifest has no alliances', () => {
    expect(rows('win_rate_by_category', { alliances: [] }).map(r => [r[0], r[1]])).toEqual([['Bharatiya Janata Party', 2], ['Rashtriya Janata Dal', 2], ['Janata Dal (United)', 1], ['AIMIM', 1]]);
  });

  it('seats without a leader are excluded, so a pending-only election has no sections', () => {
    expect(run({ seats: [{ id: 'X', name: 'X', party: '', status: 'PENDING', type: 'SC' as const }] })).toEqual([]);
    expect(run({ seats: [] })).toEqual([]);
  });
});
