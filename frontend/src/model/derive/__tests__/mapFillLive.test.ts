import { describe, it, expect } from 'vitest';
import { seatFill, countingLive, MOMENTUM_FILL, MAP_FILL, type FillContext } from '../mapFill';
import type { SeatLive } from '../seatAnalysis';
import type { SeatResult } from '../../types/dashboard';

const seat = (id: string, party = 'BJP', margin = 500) => ({ id, party, margin, status: 'LEADING', name: id }) as unknown as SeatResult;
const live = (id: string, call: SeatLive['call'], momentum: SeatLive['momentum'] = null) => [id, { const_id: id, call, momentum }] as [string, SeatLive];
const ctx = (layer: FillContext['layer'], l?: [string, SeatLive][]): FillContext => ({
  layer, electionType: 'VS', partyColor: new Map([['BJP', '#f80']]), highlight: { parties: new Set(), seats: new Set() }, live: l ? new Map(l) : undefined,
});

describe('live fills', () => {
  it('Overview: strength by call; too close is faint and dashed', () => {
    const c = ctx('overview', [live('A', 'safe'), live('B', 'likely'), live('C', 'too_close'), live('D', 'declared'), live('E', 'counting')]);
    expect(seatFill(seat('A'), c)).toEqual({ color: '#f80', opacity: 1, highlighted: false });
    expect(seatFill(seat('B'), c).opacity).toBe(0.6);
    expect(seatFill(seat('C'), c)).toEqual({ color: '#f80', opacity: 0.3, dashed: true, highlighted: false });
    expect(seatFill(seat('D'), c).opacity).toBe(1);
    expect(seatFill(seat('E'), c).opacity).toBe(0.6);
  });
  it('Overview without live data is unchanged (opacity 1, no dash)', () => {
    expect(seatFill(seat('A'), ctx('overview'))).toEqual({ color: '#f80', opacity: 1, highlighted: false });
  });
  it('Battle live: momentum colours, ignoring party; no momentum or declared → stable', () => {
    const c = ctx('battle', [live('A', 'likely', 'switched'), live('B', 'too_close', 'narrowing'), live('C', 'safe', 'widening'), live('D', 'declared', 'stable'), live('E', 'counting', null)]);
    expect(seatFill(seat('A'), c).color).toBe(MOMENTUM_FILL.switched);
    expect(seatFill(seat('B'), c).color).toBe(MOMENTUM_FILL.narrowing);
    expect(seatFill(seat('C'), c).color).toBe(MOMENTUM_FILL.widening);
    expect(seatFill(seat('D'), c).color).toBe(MOMENTUM_FILL.stable);
    expect(seatFill(seat('E'), c)).toEqual({ color: MOMENTUM_FILL.stable, opacity: 1, highlighted: false });
  });
  it('Battle without live data keeps the margin buckets', () => {
    expect(seatFill(seat('A', 'BJP', 500), ctx('battle')).opacity).toBe(0.25);
  });
  it('a seat with no leader stays pending on every layer', () => {
    expect(seatFill(seat('A', ''), ctx('overview', [live('A', 'not_started')])).color).toBe(MAP_FILL.pending);
  });
  it('a highlighted seat shows at full strength without the dash; others dim', () => {
    const c = { ...ctx('overview', [live('A', 'too_close'), live('B', 'too_close')]), highlight: { parties: new Set<string>(), seats: new Set(['A']) } };
    expect(seatFill(seat('A'), c)).toEqual({ color: '#f80', opacity: 1, highlighted: true });
    expect(seatFill(seat('B'), c)).toMatchObject({ opacity: 0.12, highlighted: false });
  });
});

describe('countingLive', () => {
  it('live data only while some seat is still counting (all declared or none started → today\'s look, Battle margin buckets)', () => {
    const m = (calls: SeatLive['call'][]) => new Map(calls.map((c, i) => [`S${i}`, { const_id: `S${i}`, call: c } as SeatLive]));
    expect(countingLive(m(['declared', 'declared']))).toBeUndefined();
    expect(countingLive(m(['not_started', 'not_started']))).toBeUndefined();
    expect(countingLive(undefined)).toBeUndefined();
    const live = m(['declared', 'too_close']);
    expect(countingLive(live)).toBe(live);
  });
});

describe('not-started seats while live', () => {
  it('are pending grey on the Overview and on Battle, even with a party on the row', () => {
    const l: [string, SeatLive][] = [['A', { const_id: 'A', call: 'not_started', momentum: null } as unknown as SeatLive]];
    expect(seatFill(seat('A'), ctx('overview', l))).toEqual({ color: MAP_FILL.pending, opacity: 1, highlighted: false });
    expect(seatFill(seat('A'), ctx('battle', l))).toEqual({ color: MAP_FILL.pending, opacity: 1, highlighted: false });
  });
});
