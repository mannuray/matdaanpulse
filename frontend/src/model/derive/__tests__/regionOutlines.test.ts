import { describe, expect, it } from 'vitest';
import { regionOutlines } from '../regionOutlines';

const regions = [{ name: 'Ang', seatIds: ['A', 'B'] }, { name: 'Kosi', seatIds: ['C'] }];

describe('regionOutlines', () => {
  it('outlines every region, none strong without a highlight', () => {
    expect(regionOutlines(regions, new Set())).toEqual([{ name: 'Ang', seatIds: ['A', 'B'], strong: false }, { name: 'Kosi', seatIds: ['C'], strong: false }]);
  });
  it('marks the region whose seats are exactly the highlight', () => {
    expect(regionOutlines(regions, new Set(['A', 'B'])).map(r => r.strong)).toEqual([true, false]);
  });
  it('marks none for a highlight that is not one region (e.g. Statewide or a party)', () => {
    expect(regionOutlines(regions, new Set(['A', 'B', 'C'])).map(r => r.strong)).toEqual([false, false]);
    expect(regionOutlines(regions, new Set(['A'])).map(r => r.strong)).toEqual([false, false]);
  });
  it('skips regions without seats', () => {
    expect(regionOutlines([{ name: 'X', seatIds: [] }], new Set())).toEqual([]);
  });
});
