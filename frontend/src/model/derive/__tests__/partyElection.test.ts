import { describe, it, expect } from 'vitest';
import { partyElectionStats, partyKeyCandidates } from '../partyElection';
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

describe('partyKeyCandidates', () => {
  const card = (name: string, partyId: string, constId: string, status: 'WON' | 'PENDING' | 'LOST', margin: number | null = null) =>
    ({ key: `${constId}|${name}`, name, constId, constName: constId, partyId, status, margin, custom: false });
  const winner = (const_id: string, party_id: string, candidate_name: string, margin: number, status = 'WON'): ResultRow => ({ const_id, party_id, candidate_name, votes: 1, status, margin });
  const winners = new Map([
    ['A', winner('A', 'RJD', 'TEJ', 100)], ['B', winner('B', 'RJD', 'BIG', 9000)], ['C', winner('C', 'RJD', 'MID', 500, 'LEADING')],
    ['D', winner('D', 'BJP', 'OTHER', 99999)], ['E', winner('E', 'RJD', 'SMALL', 50)],
  ]);

  it('lists the party leaders first (a seatless one as party leader), then its biggest wins, up to the limit', () => {
    const leaders = [card('Tejashwi', 'RJD', 'A', 'WON', 100), card('Nitish', 'JDU', '', 'PENDING'), card('Lalu', 'RJD', '', 'PENDING')];
    const out = partyKeyCandidates('RJD', leaders, winners, 4);
    expect(out.map(c => [c.name, c.constId, c.status, c.leader])).toEqual([
      ['Tejashwi', 'A', 'WON', true], ['Lalu', '', null, true], ['BIG', 'B', 'WON', false], ['MID', 'C', 'LEADING', false],
    ]);
  });

  it('a party without leaders shows its biggest wins only; no duplicates of a leader seat', () => {
    expect(partyKeyCandidates('RJD', [], winners, 2).map(c => c.constId)).toEqual(['B', 'C']);
  });
  it('carries the seat number parsed from a VS id', () => {
    const w = new Map([['BR_VS_128_RAGHOPUR', winner('BR_VS_128_RAGHOPUR', 'RJD', 'T', 10)]]);
    expect(partyKeyCandidates('RJD', [], w)[0]).toMatchObject({ constNo: 128, constName: 'Raghopur' });
  });
});
