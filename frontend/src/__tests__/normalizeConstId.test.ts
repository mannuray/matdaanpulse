import { describe, it, expect } from 'vitest';
import { normalizeConstId } from '../utils/normalizeConstId';
import { calculateDominance } from '../services/intelligence.service';
import { calculateSwing } from '../hooks/useHistoryAnalysis';
import type { ResultRow } from '../types';

const PAIRS: [string, string][] = [
  ['BR_AURANGABAD', 'MH_AURANGABAD'],
  ['UP_HAMIRPUR', 'HP_HAMIRPUR'],
  ['BR_MAHARAJGANJ', 'UP_MAHARAJGANJ'],
];

const won = (const_id: string, party_id: string, margin = 1000): ResultRow =>
  ({ const_id, party_id, status: 'WON', votes: 500000, margin, candidate_name: `${party_id} cand` });

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

describe('history analysis with same-named seats', () => {
  it('swing does not cross-match seats from different states', () => {
    const prev = PAIRS.flatMap(([a, b]) => [won(a, 'INC'), won(b, 'BJP')]);
    const current = new Map(PAIRS.flatMap(([a, b]) => [[a, won(a, 'INC')], [b, won(b, 'BJP')]] as [string, ResultRow][]));
    const swing = calculateSwing(prev, current);
    for (const [a, b] of PAIRS) {
      expect(swing.get(a)).toMatchObject({ prevParty: 'INC', currentParty: 'INC', flipped: false });
      expect(swing.get(b)).toMatchObject({ prevParty: 'BJP', currentParty: 'BJP', flipped: false });
    }
  });

  it('dominance keeps a separate history per seat', () => {
    const hist = [PAIRS.flatMap(([a, b]) => [won(a, 'RJD'), won(b, 'SS')])];
    const current = new Map(PAIRS.flatMap(([a, b]) => [[a, won(a, 'RJD')], [b, won(b, 'SS')]] as [string, ResultRow][]));
    const normToConstId = new Map([...current.keys()].map(id => [normalizeConstId(id), id]));
    const dom = calculateDominance(hist, current, normToConstId);
    for (const [a, b] of PAIRS) {
      expect(dom.get(a)?.winners.map(w => w.party)).toEqual(['RJD', 'RJD']);
      expect(dom.get(b)?.winners.map(w => w.party)).toEqual(['SS', 'SS']);
    }
  });
});
