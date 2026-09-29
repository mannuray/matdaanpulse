import { describe, it, expect } from 'vitest';
import { deriveScoreboard } from '../scoreboard';
import type { PartySeats } from '../../types/dashboard';

const parties: PartySeats[] = [
  { id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 89 },
  { id: 'JDU', name: 'Janata Dal (United)', color: '#1FA37A', seats: 85 },
  { id: 'RJD', name: 'Rashtriya Janata Dal', color: '#7BD34A', seats: 25 },
  { id: 'LJPRV', name: 'Lok Janshakti Party (Ram Vilas)', color: '#3B8BFF', seats: 19 },
  { id: 'INC', name: 'Indian National Congress', color: '#38C6F4', seats: 6 },
  { id: 'AIMIM', name: 'AIMIM', color: '#2BB673', seats: 5 },
  { id: 'HAMS', name: 'HAM(S)', color: '#E8C547', seats: 5 },
  { id: 'RLM', name: 'RLM', color: '#D06CB0', seats: 4 },
  { id: 'CPIML', name: 'CPI(ML)', color: '#E5484D', seats: 2 },
  { id: 'CPIM', name: 'CPI(M)', color: '#E5484D', seats: 1 },
  { id: 'IIP', name: 'IIP', color: '#8A93A6', seats: 1 },
  { id: 'BSP', name: 'BSP', color: '#4B5BD6', seats: 1 },
];
const alliances = [
  { id: 'NDA', name: 'NDA', color: '#FF7A1A', parties: ['BJP', 'JDU', 'LJPRV', 'HAMS', 'RLM'] },
  { id: 'MGB', name: 'Mahagathbandhan', color: '#7BD34A', parties: ['RJD', 'INC', 'CPIML', 'CPIM'] },
];

describe('deriveScoreboard', () => {
  it('sums alliance seats and vote share and computes others', () => {
    const pct = new Map([['BJP', 20.1], ['JDU', 19.2], ['LJPRV', 5], ['HAMS', 2.3], ['RLM', 1.5], ['RJD', 23], ['INC', 8.7], ['CPIML', 3], ['CPIM', 2.4]]);
    const s = deriveScoreboard(alliances, parties, pct, 243, 122);
    expect(s.blocs.map(b => [b.id, b.seats])).toEqual([['NDA', 202], ['MGB', 34]]);
    expect(s.blocs[0].votePct).toBe(48.1);
    expect(s.blocs[1].votePct).toBe(37.1);
    expect(s.others).toEqual({ seats: 7, votePct: 14.8 });
    expect(s.countedSeats).toBe(243);
    expect(s.winnerId).toBe('NDA');
    expect(s.marginOverMajority).toBe(80);
  });

  it('falls back to the top two parties when the manifest has no alliances', () => {
    const s = deriveScoreboard([], parties, new Map(), 243, 122);
    expect(s.blocs.map(b => [b.id, b.kind])).toEqual([['BJP', 'party'], ['JDU', 'party']]);
    expect(s.others.seats).toBe(243 - 89 - 85);
    expect(s.blocs[0].votePct).toBeNull();
    expect(s.winnerId).toBeNull();
  });

  it('handles zero results (upcoming election)', () => {
    const s = deriveScoreboard(alliances, parties.map(p => ({ ...p, seats: 0 })), new Map(), 243, 122);
    expect(s.countedSeats).toBe(0);
    expect(s.others.seats).toBe(0);
    expect(s.winnerId).toBeNull();
    expect(s.marginOverMajority).toBeNull();
  });
});
