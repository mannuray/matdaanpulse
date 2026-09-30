import { describe, it, expect } from 'vitest';
import { diffLeaders, leaderMap } from '../utils/liveUpdates';
import type { ResultRow } from '../types';

const r = (const_id: string, party_id: string, votes: number, status: string, margin = 0): ResultRow =>
  ({ const_id, party_id, candidate_name: `${party_id}-c`, votes, status, margin });

describe('leaderMap', () => {
  it('keeps WON/LEADING rows only, highest votes per seat', () => {
    const m = leaderMap([r('A', 'X', 10, 'LEADING'), r('A', 'Y', 20, 'LEADING'), r('B', 'Z', 5, 'TRAILING')]);
    expect(m.get('A')?.party_id).toBe('Y');
    expect(m.has('B')).toBe(false);
  });
});

describe('diffLeaders', () => {
  it('reports a new leading party as a lead change', () => {
    const out = diffLeaders([r('A', 'X', 10, 'LEADING'), r('A', 'Y', 5, 'TRAILING')], [r('A', 'X', 10, 'TRAILING'), r('A', 'Y', 15, 'LEADING', 5)]);
    expect(out).toEqual([{ const_id: 'A', party_id: 'Y', prevParty: 'X', margin: 5, kind: 'lead' }]);
  });

  it('reports a declaration of the same leader as won', () => {
    const out = diffLeaders([r('A', 'X', 10, 'LEADING')], [r('A', 'X', 12, 'WON', 3)]);
    expect(out).toEqual([{ const_id: 'A', party_id: 'X', prevParty: 'X', margin: 3, kind: 'won' }]);
  });

  it('a first leader in a seat that had none is a change; unchanged seats are not', () => {
    const out = diffLeaders([r('A', 'X', 10, 'WON'), r('B', 'Y', 0, 'TRAILING')], [r('A', 'X', 11, 'WON'), r('B', 'Y', 1, 'LEADING')]);
    expect(out).toEqual([{ const_id: 'B', party_id: 'Y', prevParty: undefined, margin: 0, kind: 'lead' }]);
  });

  it('vote-only changes produce no events', () => {
    expect(diffLeaders([r('A', 'X', 10, 'LEADING', 1)], [r('A', 'X', 99, 'LEADING', 50)])).toEqual([]);
  });
});
