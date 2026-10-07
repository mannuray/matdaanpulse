import { describe, it, expect } from 'vitest';
import { mapAnalysis } from '../data/useAnalysis';
import type { AnalysisEntry } from '../../model/types';

const data = {
  winner: { party_id: 'BJP', name: 'R' }, margin: 500, seat_type: 'three-way',
  outcome: { kind: 'gained', from: 'RJD', from_raw: 'RJD' },
  class: { kind: 'swing', holder: 'BJP', streak: 1, since: 2025, wins: 1, total: 4 },
  incumbent: { name: 'S', party: 'RJD', won: false },
  history: [{ year: 2020, party: 'RJD', margin: 10 }, { year: 2025, party: 'BJP', margin: 500 }],
  notes: [{ kind: 'spoiler', name: 'C', party: 'AIMIM', votes: 900, margin: 500, hurts: 'MGB', label: 'AIMIM split' },
          { kind: 'switcher', name: 'R', from: 'JDU', to: 'BJP', year: 2020, match: 'person' }],
} as unknown as NonNullable<AnalysisEntry['data']>;
const rows = [{ id: '1', const_id: 'BR_1', election_id: 'e', dominance: 'swing', dominance_party: 'BJP', data }, { id: '2', const_id: 'BR_2', election_id: 'e', dominance: null, dominance_party: null }] as AnalysisEntry[];

describe('mapAnalysis', () => {
  it('maps data into the dashboard maps; rows without data are skipped', () => {
    const m = mapAnalysis(rows);
    expect(m.dominanceMap.get('BR_1')).toEqual({ constId: 'BR_1', winners: [{ party: 'RJD' }, { party: 'BJP' }], classification: 'swing', dominantParty: 'BJP', streak: 1 });
    expect(m.swingMap.get('BR_1')).toEqual({ constId: 'BR_1', currentParty: 'BJP', prevParty: 'RJD', currentMargin: 500, prevMargin: 10, flipped: true, split: false });
    expect(m.incumbencyData).toEqual([{ constId: 'BR_1', incumbentName: 'S', incumbentParty: 'RJD', won: false, currentMargin: 500 }]);
    expect(m.partySwitchData).toEqual([{ constId: 'BR_1', candidateName: 'R', fromParty: 'JDU', toParty: 'BJP', fromYear: 2020, toYear: 2025, wonInNewParty: true, margin: 500 }]);
    expect(m.spoilerMap.get('BR_1')).toEqual({ spoilerParty: 'AIMIM split', spoilerVotes: 900, winnerMargin: 500, hurtsAlliance: 'MGB' });
    expect(m.seatTypeMap.get('BR_1')).toBe('three-way');
    expect(m.dominanceMap.has('BR_2')).toBe(false);
  });
});
