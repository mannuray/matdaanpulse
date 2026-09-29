import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import type { SwingEntry } from '../../../types';
import { makeCtx } from './fixtures';

const e = (constId: string, prev: string, cur: string, margin: number): [string, SwingEntry] =>
  [constId, { constId, prevParty: prev, currentParty: cur, currentMargin: margin, prevMargin: 1, flipped: prev !== cur }];

const swing = new Map([e('A', 'BJP', 'RJD', 500), e('B', 'BJP', 'RJD', 2500), e('C', 'RJD', 'JDU', 900), e('D', 'JDU', 'AIMIM', 100), e('G', 'BJP', 'BJP', 30000)]);
const run = (over = {}) => deriveLayerSummary('swing', makeCtx({ swing, ...over })).sections.filter(s => s.id !== 'key_stats');

describe('swing summary', () => {
  it('sections in the binding order', () => {
    expect(run().map(s => s.id)).toEqual(['flipped', 'net_swing']);
  });

  it('net_swing: gained / lost / net per alliance, party when it has no alliance', () => {
    // Legacy SwingSection.tsx:35-36,59: losses[from]++, gains[to]++, net = gains - losses, keyed by alliance id or party.
    // A, B: NDA -> MGB; C: MGB -> NDA; D: NDA -> AIMIM (no alliance). G did not flip.
    // MGB +2 -1 = +1, AIMIM +1, NDA +1 -3 = -2; sorted by net desc (SwingSection.tsx:62).
    const s = run()[1];
    // Legacy columns: Gained, Lost, Net (the compact card shows Net).
    expect(s.columnsKeys).toEqual(['studio_col_gained', 'studio_col_lost', 'studio_col_net']);
    expect(s.primaryCol).toBe(2);
    expect(s.rows.map(r => [r.label, r.value, r.extra!.map(x => x.value)])).toEqual([
      ['MGB', 2, [1, 1]], ['AIMIM', 1, [0, 1]], ['NDA', 1, [3, -2]],
    ]);
    expect(s.rows[2].bar).toEqual({ value: -2, max: 2, color: '#FF7A1A' });
    expect(s.rows[1].color).toBe('#2BB673');
  });

  it('flipped: closest first with from -> to', () => {
    // SwingSection.tsx:47 sorts by the flip\'s current margin ascending: D 100, A 500, C 900, B 2500.
    const s = run()[0];
    expect(s.titleParams).toEqual({ count: 4 });
    expect(s.rows.map(r => [r.label, r.sub, r.value])).toEqual([
      ['D', 'NDA → AIMIM', 100], ['A', 'NDA → MGB', 500], ['C', 'MGB → NDA', 900], ['B', 'NDA → MGB', 2500],
    ]);
    expect(s.rows[0].valueFormat).toBe('compact');
    expect(s.more).toBe(0);
    const many = new Map(Array.from({ length: 20 }, (_, i) => e(`S${i}`, 'BJP', 'RJD', i + 1)));
    const big = run({ swing: many })[0];
    expect([big.rows.length, big.more, big.titleParams]).toEqual([15, 5, { count: 20 }]);
    expect(s.rows[0]).toMatchObject({ seatIds: ['D'], partyIds: ['JDU', 'AIMIM'], color: '#2BB673' });
  });

  it('is empty without comparison data or without flips', () => {
    expect(run({ swing: undefined })).toEqual([]);
    expect(run({ swing: new Map() })).toEqual([]);
    expect(run({ swing: new Map([e('A', 'BJP', 'BJP', 5)]) })).toEqual([]);
  });
});
