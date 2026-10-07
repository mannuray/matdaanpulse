import { describe, it, expect } from 'vitest';
import { normalizeConstId } from '../utils/normalizeConstId';

const PAIRS: [string, string][] = [
  ['BR_AURANGABAD', 'MH_AURANGABAD'],
  ['UP_HAMIRPUR', 'HP_HAMIRPUR'],
  ['BR_MAHARAJGANJ', 'UP_MAHARAJGANJ'],
];

describe('normalizeConstId', () => {
  it.each(PAIRS)('keeps %s and %s distinct', (a, b) => {
    expect(normalizeConstId(a)).not.toBe(normalizeConstId(b));
    // Stable across elections for the same seat.
    expect(normalizeConstId(a)).toBe(normalizeConstId(a));
  });

  it('matches VS seats across years within a state by const_no', () => {
    expect(normalizeConstId('BR_VS10_12_BACHWARA')).toBe(normalizeConstId('BR_VS20_12_BACHHWARA'));
    expect(normalizeConstId('BR_VS_195_AGIAON')).toBe(normalizeConstId('BR_VS20_195_AGIAON'));
    expect(normalizeConstId('WB_VS21_12_X')).not.toBe(normalizeConstId('BR_VS21_12_X'));
  });

  it('leaves bare LS names unchanged and does not split non-state prefixes', () => {
    expect(normalizeConstId('AGRA')).toBe('AGRA');
    expect(normalizeConstId('AHMEDABAD_EAST')).toBe('AHMEDABAD_EAST');
    expect(normalizeConstId('NEW_DELHI')).toBe('NEW_DELHI');
  });
});
