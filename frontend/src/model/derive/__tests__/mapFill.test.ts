import { describe, it, expect } from 'vitest';
import { seatFill, marginOpacity, MAP_FILL, DIM_OPACITY, type FillContext } from '../mapFill';
import type { SeatResult } from '../../types/dashboard';

const seat = (over: Partial<SeatResult> = {}): SeatResult => ({ id: 'A', name: 'A', party: 'BJP', margin: 30000, status: 'WON', type: 'GEN', ...over });
const ctx = (over: Partial<FillContext> = {}): FillContext => ({
  layer: 'overview', electionType: 'VS', partyColor: new Map([['BJP', '#FF7A1A'], ['JDU', '#1FA37A']]),
  highlight: { parties: new Set(), seats: new Set() }, ...over,
});

describe('seatFill', () => {
  it('pending seats use the pending colour on every layer', () => {
    expect(seatFill(seat({ party: '', margin: undefined, status: 'PENDING' }), ctx({ layer: 'battle' }))).toEqual({ color: MAP_FILL.pending, opacity: 1 });
  });
  it('overview: solid party colour', () => {
    expect(seatFill(seat(), ctx())).toEqual({ color: '#FF7A1A', opacity: 1 });
  });
  it('battle: close margins are dimmer than safe ones', () => {
    expect(seatFill(seat({ margin: 500 }), ctx({ layer: 'battle' })).opacity).toBeLessThan(seatFill(seat({ margin: 60000 }), ctx({ layer: 'battle' })).opacity);
  });
  it('swing: flipped seats solid in the new party colour, held seats dim', () => {
    const swing = new Map([
      ['A', { constId: 'A', prevParty: 'JDU', currentParty: 'BJP', currentMargin: 1, prevMargin: 1, flipped: true }],
      ['B', { constId: 'B', prevParty: 'BJP', currentParty: 'BJP', currentMargin: 1, prevMargin: 1, flipped: false }],
    ]);
    expect(seatFill(seat(), ctx({ layer: 'swing', swing }))).toEqual({ color: '#FF7A1A', opacity: 1 });
    expect(seatFill(seat({ id: 'B' }), ctx({ layer: 'swing', swing })).opacity).toBe(0.18);
  });
  it('history: strongholds solid, loyal lighter, swing seats in the swing colour', () => {
    const dominance = new Map([
      ['A', { constId: 'A', winners: [], classification: 'stronghold' as const, dominantParty: 'JDU', streak: 3 }],
      ['B', { constId: 'B', winners: [], classification: 'loyal' as const, dominantParty: 'BJP', streak: 2 }],
      ['C', { constId: 'C', winners: [], classification: 'swing' as const, streak: 1 }],
    ]);
    expect(seatFill(seat(), ctx({ layer: 'history', dominance }))).toEqual({ color: '#1FA37A', opacity: 1 });
    expect(seatFill(seat({ id: 'B' }), ctx({ layer: 'history', dominance }))).toEqual({ color: '#FF7A1A', opacity: 0.55 });
    expect(seatFill(seat({ id: 'C' }), ctx({ layer: 'history', dominance }))).toEqual({ color: MAP_FILL.swing, opacity: 1 });
  });
  it('reserved: SC/ST solid, general seats dim', () => {
    expect(seatFill(seat({ type: 'SC' }), ctx({ layer: 'demographics' })).opacity).toBe(1);
    expect(seatFill(seat(), ctx({ layer: 'demographics' })).opacity).toBe(DIM_OPACITY);
  });
  it('insights: spoiler seats solid, three-way in amber, rest dim', () => {
    const c = ctx({ layer: 'insights', spoilerSeats: new Set(['A']), threeWaySeats: new Set(['B']) });
    expect(seatFill(seat(), c).opacity).toBe(1);
    expect(seatFill(seat({ id: 'B' }), c)).toEqual({ color: MAP_FILL.threeWay, opacity: 1 });
    expect(seatFill(seat({ id: 'Z' }), c).opacity).toBe(DIM_OPACITY);
  });
  it('an active highlight dims every seat outside it', () => {
    const c = ctx({ highlight: { parties: new Set(['JDU']), seats: new Set(['K']) } });
    expect(seatFill(seat(), c).opacity).toBe(DIM_OPACITY);
    expect(seatFill(seat({ id: 'K' }), c).opacity).toBe(1);
    expect(seatFill(seat({ party: 'JDU' }), c).opacity).toBe(1);
  });
  it('pending seats respect highlight filter', () => {
    const pending = seat({ party: '', margin: undefined, status: 'PENDING' });
    const c = ctx({ highlight: { parties: new Set(), seats: new Set(['A']) } });
    expect(seatFill(pending, c)).toEqual({ color: MAP_FILL.pending, opacity: 1 });
    const c2 = ctx({ highlight: { parties: new Set(), seats: new Set(['B']) } });
    expect(seatFill(pending, c2)).toEqual({ color: MAP_FILL.pending, opacity: DIM_OPACITY });
    const c3 = ctx({ highlight: { parties: new Set(), seats: new Set() } });
    expect(seatFill(pending, c3)).toEqual({ color: MAP_FILL.pending, opacity: 1 });
  });
});

describe('marginOpacity', () => {
  it('maps VS margin buckets to rising opacity', () => {
    expect([500, 3000, 10000, 30000, 80000].map(m => marginOpacity(m, 'VS'))).toEqual([0.25, 0.45, 0.65, 0.85, 1]);
  });
});
