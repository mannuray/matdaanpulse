import { describe, it, expect } from 'vitest';
import { partySeatFills } from '../partyMap';
import type { ResultRow } from '../../types';

const r = (const_id: string, party_id: string, status: string): ResultRow => ({ const_id, party_id, candidate_name: 'x', votes: 1, status, margin: 0 });

describe('partySeatFills', () => {
  it('won = party colour; contested and lost = faint tint; not contested = pending', () => {
    const fills = partySeatFills('BJP', [r('A', 'BJP', 'WON'), r('A', 'JMM', 'LOST'), r('B', 'BJP', 'LOST'), r('B', 'JMM', 'WON'), r('C', 'JMM', 'WON')], '#f80');
    expect(fills.get('A')).toEqual({ color: '#f80', opacity: 1, result: 'won' });
    expect(fills.get('B')).toEqual({ color: '#f80', opacity: 0.25, result: 'lost' });
    expect(fills.get('C')).toEqual({ color: 'var(--color-map-pending)', opacity: 1, result: 'none' });
  });
});
