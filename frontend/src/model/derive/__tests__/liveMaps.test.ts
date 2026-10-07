import { describe, it, expect } from 'vitest';
import { liveMaps, prevYearOf } from '../liveMaps';
import type { Baseline, SeatLive } from '../seatAnalysis';

const b = { schema_version: 1, election_id: 'e', date: '2027-02-27', state_id: 1, lineage: [], alliances: [], seats: [{
  const_id: 'S1', const_no: 1, electors: null, close_last: false, narrowing_last: false, rematch: null, heavyweights: [],
  prev: { year: 2022, date: '2022-03-10', party_raw: 'SP', holder: 'SP', alliance: null, candidate: 'R', person_id: null, margin: 900, margin_pct: 1, shares: { SP: 45 }, turnout: 60 },
  class_before: { kind: 'loyal', holder: 'SP', streak: 2, since: 2017, wins: 2, total: 3 },
  sitting: { name: 'R', person_id: null, party: 'SP', match: 'name', recontested: true, const_id: 'S1', same_seat: true, party_now: 'SP', switched: false, followed_split: false },
  switchers: [{ kind: 'switcher', name: 'Q', from: 'BSP', to: 'BJP', year: 2022, match: 'person' }],
  history: [{ year: 2017, party: 'BJP', family: 'BJP', candidate: 'X', person_id: null, margin: 1, vote_share: 40, runner_up: null, runner_up_party: null }, { year: 2022, party: 'SP', family: 'SP', candidate: 'R', person_id: null, margin: 900, vote_share: 45, runner_up: null, runner_up_party: null }],
}] } as unknown as Baseline;
const live = [{ const_id: 'S1', leader: { name: 'Q', party_id: 'BJP', person_id: null, votes: 5000, share: 50 }, margin: 300, provisional: true,
  outcome: { kind: 'gained', from: 'SP', from_raw: 'SP' }, sitting: 'trailing' }] as unknown as SeatLive[];

describe('liveMaps', () => {
  it('maps baseline + live into the dashboard maps', () => {
    const m = liveMaps(b, live, 2027);
    expect(m.dominance.get('S1')).toEqual({ constId: 'S1', winners: [{ party: 'BJP' }, { party: 'SP' }], classification: 'loyal', dominantParty: 'SP', streak: 2 });
    expect(m.swing.get('S1')).toEqual({ constId: 'S1', currentParty: 'BJP', prevParty: 'SP', currentMargin: 300, prevMargin: 900, flipped: true, split: false });
    expect(m.incumbency).toEqual([{ constId: 'S1', incumbentName: 'R', incumbentParty: 'SP', won: false, currentMargin: 300 }]);
    expect(m.partySwitches).toEqual([{ constId: 'S1', candidateName: 'Q', fromParty: 'BSP', toParty: 'BJP', fromYear: 2022, toYear: 2027, wonInNewParty: true, margin: 300 }]);
  });
  it('before counting: dominance and switchers from the baseline, no swing, no incumbency results', () => {
    const m = liveMaps(b, [], 2027);
    expect(m.dominance.size).toBe(1);
    expect(m.swing.size).toBe(0);
    expect(m.incumbency).toEqual([]);
    expect(m.partySwitches).toHaveLength(1);
  });
});

describe('prevYearOf', () => {
  it('the baseline\'s previous election year wins over the manifest\'s history years', () => {
    expect(prevYearOf(b, [2010, 2015, 2020])).toBe(2022);
    expect(prevYearOf(null, [2010, 2015, 2020])).toBe(2020);
    expect(prevYearOf(null, [])).toBeNull();
  });
});

describe('liveMaps incumbency', () => {
  it('a sitting MLA who is not contesting is not listed as an incumbent who lost', () => {
    const notContesting = [{ ...live[0], sitting: 'not_contesting' }] as unknown as SeatLive[];
    expect(liveMaps(b, notContesting, 2027).incumbency).toEqual([]);
  });
});
