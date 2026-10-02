import { describe, it, expect } from 'vitest';
import { partyElectionStats } from '../partyElection';
import type { ResultRow } from '../../types';

const r = (const_id: string, party_id: string, status: string): ResultRow => ({ const_id, party_id, candidate_name: 'x', votes: 1, status, margin: 0 });

describe('partyElectionStats', () => {
  it('counts won, leading and contested seats, with vote share and alliance', () => {
    const rows = [r('A', 'RJD', 'WON'), r('B', 'RJD', 'LEADING'), r('C', 'RJD', 'TRAILING'), r('C', 'RJD', 'TRAILING'), r('A', 'BJP', 'LOST')];
    expect(partyElectionStats('RJD', rows, new Map([['RJD', 23.1]]), [{ id: 'MGB', name: 'Mahagathbandhan', parties: ['RJD'] }]))
      .toEqual({ won: 1, leading: 1, contested: 3, votePct: 23.1, alliance: { id: 'MGB', name: 'Mahagathbandhan' } });
  });
  it('a party with no rows has zeros and no alliance', () => {
    expect(partyElectionStats('X', [], new Map(), [])).toEqual({ won: 0, leading: 0, contested: 0, votePct: null, alliance: null });
  });
});
