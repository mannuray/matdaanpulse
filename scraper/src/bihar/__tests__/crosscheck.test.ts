// scraper/src/bihar/__tests__/crosscheck.test.ts
import { describe, it, expect } from 'vitest';
import { crossCheck, validateElection } from '../crosscheck';
import type { ElectionJson, RawElection } from '../types';

function election(): RawElection {
  return {
    year: 2020,
    parties: [{ abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' }, { abbr: 'INC', name: 'Indian National Congress', recognition: 'National' }],
    seats: [{ constNo: 2, acName: 'Ramnagar', type: null, electors: 1000, nota: 10, totalVotes: 610, candidates: [
      { serial: 1, name: 'A', sex: 'F', age: 60, party: 'BJP', general: 400, postal: 0, total: 400 },
      { serial: 2, name: 'B', sex: 'M', age: 50, party: 'INC', general: 200, postal: 0, total: 200 },
    ] }],
    summaries: [{ constNo: 2, name: 'Ramnagar', type: 'SC', electors: 1000, voters: 615, contested: 2, totalValid: 600, nota: 10, pollDate: '2020-11-07',
      winner: { party: 'Bharatiya Janata Party', name: 'A', votes: 400 }, runnerUp: { party: 'Indian National Congress', name: 'B', votes: 200 }, margin: 200 }],
    performance: [{ abbr: 'BJP', contested: 1, won: 1, votes: 400 }, { abbr: 'INC', contested: 1, won: 0, votes: 200 }],
  };
}

describe('crossCheck', () => {
  it('passes when the tables agree (party given by full name or abbreviation)', () => {
    expect(crossCheck(election(), [])).toEqual([]);
    const e = election(); e.summaries[0].winner.party = 'BJP'; e.summaries[0].runnerUp.party = 'INC';
    expect(crossCheck(e, [])).toEqual([]);
  });
  it('reports each mismatch with its key', () => {
    const e = election();
    e.seats[0].electors = 999; e.seats[0].candidates[1].total = 201; e.performance[0].won = 2;
    const errs = crossCheck(e, []);
    expect(errs.map(x => x.split(' ')[0])).toEqual(expect.arrayContaining(['electors:2', 'total-valid:2', 'runner-up:2', 'margin:2', 'party-won:BJP', 'party-votes:INC']));
  });
  it('drops errors listed as exceptions for the year', () => {
    const e = election(); e.seats[0].electors = 999;
    expect(crossCheck(e, [{ year: 2020, key: 'electors:2', reason: 'ECI tables disagree' }])).toEqual([]);
    expect(crossCheck(e, [{ year: 2015, key: 'electors:2', reason: 'other year' }])).toHaveLength(1);
  });
  it('reports seats missing from either table', () => {
    const e = election(); e.summaries = [];
    expect(crossCheck(e, [])[0]).toMatch(/^summary-missing:2/);
  });
});

function json(): ElectionJson {
  const seat = (constNo: number, type: 'GEN' | 'SC' | 'ST') => ({ constNo, type, electors: 1000, voters: 600, turnout: 60, phase: 1, pollDate: '2020-10-28', candidates: [
    { serial: 1, name: 'A', partyId: 'BJP', sex: 'M' as const, age: 40, votes: 400, status: 'WON' as const },
    { serial: 2, name: 'B', partyId: 'INC', sex: 'M' as const, age: 40, votes: 150, status: 'LOST' as const },
    { serial: 3, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: 50, status: 'LOST' as const },
  ] });
  const seats = Array.from({ length: 243 }, (_, i) => seat(i + 1, i < 38 ? 'SC' : i < 40 ? 'ST' : 'GEN'));
  return { year: 2020, electionId: 'x', source: { title: 't', url: 'u', retrieved: '2026-10-03' }, parties: [], seats };
}

describe('validateElection', () => {
  it('accepts a well-formed election (phase count per year)', () => {
    const e = json(); e.seats.forEach((s, i) => { s.phase = (i % 3) + 1; });
    expect(validateElection(e)).toEqual([]);
  });
  it('rejects two winners, wrong reservation counts, turnout out of range and wrong phase count', () => {
    const e = json();
    e.seats[0].candidates[1].status = 'WON';
    e.seats[50].type = 'SC';
    e.seats[60].turnout = 101;
    const errs = validateElection(e);
    expect(errs).toEqual(expect.arrayContaining([
      expect.stringMatching(/^winners:1/), expect.stringMatching(/^reserved:/), expect.stringMatching(/^turnout:61/), expect.stringMatching(/^phases:/),
    ]));
  });
});
