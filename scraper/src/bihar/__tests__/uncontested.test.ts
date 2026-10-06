import { describe, it, expect } from 'vitest';
import { completeUncontested } from '../uncontested';
import type { RawElection, SeatSummary } from '../types';

const summary = (o: Partial<SeatSummary>): SeatSummary => ({ constNo: 3, name: 'Mukto', type: 'ST', electors: 8075, voters: 0, contested: 1, totalValid: 0, nota: 0, pollDate: '',
  winner: { party: 'Bharatiya Janata Party', name: 'PEMA KHANDU', votes: 0 }, runnerUp: null, margin: 0, uncontested: true, ...o });
const election = (o: Partial<RawElection>): RawElection => ({ year: 2024, seats: [], summaries: [], parties: [], performance: [], ...o });

describe('completeUncontested', () => {
  it('builds the seat from its summary when Detailed Results leave it out (2024): one candidate, 0 votes, marked fromSummary', () => {
    const parties = [{ abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' as const }];
    const out = completeUncontested(election({ summaries: [summary({})], parties }));
    expect(out.seats).toEqual([{ constNo: 3, acName: 'Mukto', type: 'ST', electors: 8075, nota: 0, totalVotes: 0, fromSummary: true,
      candidates: [{ serial: 1, name: 'PEMA KHANDU', sex: null, age: null, party: 'BJP', general: 0, postal: 0, total: 0 }] }]);
  });
  it('fills an all-zero summary (2019) from its Detailed Results seat: electors and winner', () => {
    const seat = { constNo: 4, acName: 'Dirang', type: null, electors: 14020, nota: null, totalVotes: 0,
      candidates: [{ serial: 1, name: 'PHURPA TSERING', sex: 'M' as const, age: 47, party: 'BJP', general: 0, postal: 0, total: 0 }] };
    const out = completeUncontested(election({ seats: [seat], summaries: [summary({ constNo: 4, electors: 0, winner: { party: '', name: '', votes: 0 } })] }));
    expect(out.summaries[0]).toMatchObject({ electors: 14020, winner: { party: 'BJP', name: 'PHURPA TSERING', votes: 0 } });
    expect(out.seats).toEqual([seat]);
  });
  it('leaves contested seats alone', () => {
    const e = election({ summaries: [summary({ uncontested: undefined, contested: 2, voters: 900 })] });
    expect(completeUncontested(e)).toEqual(e);
  });
});
