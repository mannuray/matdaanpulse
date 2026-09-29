import type { ResultRow } from '../../../types';
import type { SeatResult } from '../../../types/dashboard';
import type { SummaryContext } from '../types';

export const seat = (id: string, party: string, margin: number | undefined, type: 'GEN' | 'SC' | 'ST' = 'GEN', state?: string, status = 'WON'): SeatResult =>
  ({ id, name: id, party, margin, status: party ? status : 'PENDING', type, state });

export const alliances = [
  { id: 'NDA', name: 'NDA', color: '#FF7A1A', parties: ['BJP', 'JDU'] },
  { id: 'MGB', name: 'MGB', color: '#7BD34A', parties: ['RJD', 'INC'] },
];

export const partyColor = new Map([['BJP', '#FF7A1A'], ['JDU', '#1FA37A'], ['RJD', '#7BD34A'], ['INC', '#38C6F4'], ['AIMIM', '#2BB673']]);

export const parties = [
  { id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 2 },
  { id: 'JDU', name: 'Janata Dal (United)', color: '#1FA37A', seats: 1 },
  { id: 'RJD', name: 'Rashtriya Janata Dal', color: '#7BD34A', seats: 2 },
  { id: 'INC', name: 'Indian National Congress', color: '#38C6F4', seats: 0 },
  { id: 'AIMIM', name: 'AIMIM', color: '#2BB673', seats: 1 },
];

export const cand = (const_id: string, party_id: string, votes: number): ResultRow =>
  ({ const_id, party_id, candidate_name: party_id, votes, status: 'WON', margin: 0 });

/** Small VS election: 6 led seats (A..E, G), one pending (F) and one pending reserved seat (H). */
export function makeCtx(over: Partial<SummaryContext> = {}): SummaryContext {
  return {
    electionType: 'VS',
    seats: [
      seat('A', 'BJP', 800), seat('B', 'BJP', 12000, 'SC'), seat('C', 'RJD', 3000, 'ST'), seat('D', 'JDU', 60000),
      seat('E', 'RJD', 400, 'SC'), seat('F', '', undefined), seat('G', 'AIMIM', 30000), seat('H', '', undefined, 'SC'),
    ],
    alliances, partyColor, parties,
    votePct: new Map([['BJP', 30], ['JDU', 20], ['RJD', 25], ['INC', 5], ['AIMIM', 3], ['IND', 4]]),
    marginTrend: [], partyTrend: [], partySwitches: [], incumbency: [],
    ...over,
  };
}
