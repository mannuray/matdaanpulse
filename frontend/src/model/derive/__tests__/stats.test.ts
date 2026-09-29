import { describe, it, expect } from 'vitest';
import { deriveStats, rankSeats, flippedSeatRefs } from '../stats';
import type { SeatResult } from '../../types/dashboard';
import type { SwingEntry } from '../../types';

const seat = (id: string, party: string, margin: number | undefined, status = 'WON', name = id): SeatResult =>
  ({ id, name, party, margin, status, type: 'GEN' });

const vs: SeatResult[] = [
  seat('BR_VS_1_SANDESH', 'JDU', 27, 'WON', 'Sandesh'),
  seat('BR_VS_2_RUPAULI', 'JDU', 73572, 'WON', 'Rupauli'),
  seat('BR_VS_3_AGIAON', 'BJP', 95, 'WON', 'Agiaon'),
  seat('BR_VS_4_X', '', undefined, 'PENDING'),
];
const swing = new Map<string, SwingEntry>([
  ['BR_VS_1_SANDESH', { constId: 'BR_VS_1_SANDESH', currentParty: 'JDU', prevParty: 'RJD', currentMargin: 27, prevMargin: 900, flipped: true }],
  ['BR_VS_2_RUPAULI', { constId: 'BR_VS_2_RUPAULI', currentParty: 'JDU', prevParty: 'JDU', currentMargin: 73572, prevMargin: 19000, flipped: false }],
]);

describe('deriveStats', () => {
  it('computes declared, closest, biggest and flips', () => {
    expect(deriveStats(vs, 243, swing)).toEqual({
      declared: 3,
      total: 243,
      closest: { id: 'BR_VS_1_SANDESH', name: 'Sandesh', party: 'JDU', margin: 27 },
      biggest: { id: 'BR_VS_2_RUPAULI', name: 'Rupauli', party: 'JDU', margin: 73572 },
      flipped: 1,
    });
  });
  it('uses leading seats when nothing is declared yet (live)', () => {
    const live = [seat('A', 'BJP', 500, 'LEADING'), seat('B', 'INC', 50, 'LEADING')];
    const s = deriveStats(live, 543, null);
    expect(s.declared).toBe(0);
    expect(s.closest?.id).toBe('B');
    expect(s.flipped).toBeNull();
  });
  it('returns nulls instead of crashing when every seat is pending', () => {
    expect(deriveStats([seat('A', '', undefined, 'PENDING')], 243, new Map())).toEqual({ declared: 0, total: 243, closest: null, biggest: null, flipped: null });
  });
  it('works for Lok Sabha bare ids', () => {
    const ls = [seat('AGRA', 'BJP', 271294), seat('AURANGABAD_BR', 'RJD', 79111)];
    expect(deriveStats(ls, 543, null).closest?.id).toBe('AURANGABAD_BR');
  });
});

describe('rankSeats / flippedSeatRefs', () => {
  it('ranks closest ascending and biggest descending', () => {
    expect(rankSeats(vs, 'closest', 2).map(s => s.margin)).toEqual([27, 95]);
    expect(rankSeats(vs, 'biggest', 1).map(s => s.margin)).toEqual([73572]);
  });
  it('lists flipped seats closest first', () => {
    expect(flippedSeatRefs(vs, swing).map(s => s.id)).toEqual(['BR_VS_1_SANDESH']);
  });
});
