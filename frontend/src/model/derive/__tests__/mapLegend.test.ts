import { describe, it, expect } from 'vitest';
import { mapLegend } from '../mapLegend';
import { MOMENTUM_FILL, MAP_FILL } from '../mapFill';
import type { SeatLive } from '../seatAnalysis';

const L = (pairs: [string, Partial<SeatLive>][]) => new Map(pairs.map(([id, s]) => [id, { const_id: id, ...s } as SeatLive]));
describe('mapLegend', () => {
  it('Overview live: Safe · Likely · Too close · Not started with counts (declared counts as safe, counting as likely)', () => {
    const items = mapLegend('overview', L([['A', { call: 'safe' }], ['B', { call: 'declared' }], ['C', { call: 'likely' }], ['D', { call: 'counting' }], ['E', { call: 'too_close' }], ['F', { call: 'not_started' }]]))!;
    expect(items.map(i => [i.key, i.count, !!i.dashed])).toEqual([['safe', 2, false], ['likely', 2, false], ['too_close', 1, true], ['not_started', 1, false]]);
    expect(items[3].color).toBe(MAP_FILL.pending);
  });
  it('Battle live: Switched · Narrowing · Widening · Stable/declared', () => {
    const items = mapLegend('battle', L([['A', { momentum: 'switched' }], ['B', { momentum: 'narrowing' }], ['C', { momentum: null }]]))!;
    expect(items.map(i => [i.key, i.count])).toEqual([['switched', 1], ['narrowing', 1], ['widening', 0], ['stable', 1], ['not_started', 0]]);
    expect(items[0].color).toBe(MOMENTUM_FILL.switched);
  });
  it('no legend when not live, or on other layers', () => {
    expect(mapLegend('overview', undefined)).toBeNull();
    expect(mapLegend('swing', L([['A', { call: 'safe' }]]))).toBeNull();
  });
});

describe('mapLegend not-started on Battle', () => {
  it('counts not-started seats apart from stable / declared', () => {
    const items = mapLegend('battle', L([['A', { momentum: null, call: 'not_started' }], ['B', { momentum: 'stable', call: 'declared' }]]))!;
    expect(items.map(i => [i.key, i.count])).toEqual([['switched', 0], ['narrowing', 0], ['widening', 0], ['stable', 1], ['not_started', 1]]);
  });
});
