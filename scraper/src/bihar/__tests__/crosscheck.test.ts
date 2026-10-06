// scraper/src/bihar/__tests__/crosscheck.test.ts
import { describe, it, expect } from 'vitest';
import { crossCheck, validateElection } from '../crosscheck';
import { electionOf } from '../elections';
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

function unopposed(): RawElection {
  const e = election();
  e.seats[0] = { ...e.seats[0], nota: null, totalVotes: 0, candidates: [{ ...e.seats[0].candidates[0], general: 0, postal: 0, total: 0 }] };
  e.summaries[0] = { ...e.summaries[0], voters: 0, contested: 1, totalValid: 0, nota: null, winner: { party: 'BJP', name: 'A', votes: 0 }, runnerUp: null, margin: 0, uncontested: true };
  e.performance = [{ abbr: 'BJP', contested: 1, won: 1, votes: 0 }];
  return e;
}

describe('crossCheck', () => {
  it('a partial report (a slice of an undivided state) skips the party performance table, which counts every seat', () => {
    const e = election(); e.performance = [{ abbr: 'BJP', contested: 50, won: 30, votes: 9e6 }];
    expect(crossCheck(e, []).some(x => x.startsWith('party-'))).toBe(true);
    expect(crossCheck(e, [], { partial: true })).toEqual([]);
  });
  it('leaves seats built from a summary out of the party performance check (that table leaves them out too)', () => {
    const e = unopposed(); e.seats[0].fromSummary = true; e.performance = [{ abbr: 'BJP', contested: 0, won: 0, votes: 0 }];
    expect(crossCheck(e, [])).toEqual([]);
  });
  it('accepts a seat won unopposed (one candidate, 0 votes) and refuses one with a second candidate', () => {
    expect(crossCheck(unopposed(), [])).toEqual([]);
    const e = unopposed(); e.seats[0].candidates.push({ ...e.seats[0].candidates[0], serial: 2, party: 'INC' });
    expect(crossCheck(e, []).map(x => x.split(' ')[0])).toContain('uncontested:2');
  });
  it('passes when the tables agree (party given by full name or abbreviation)', () => {
    expect(crossCheck(election(), [])).toEqual([]);
    const e = election(); e.summaries[0].winner.party = 'BJP'; e.summaries[0].runnerUp!.party = 'INC';
    expect(crossCheck(e, [])).toEqual([]);
  });
  it('reports each mismatch with its key', () => {
    const e = election();
    e.seats[0].electors = 999; e.seats[0].candidates[1].total = 201; e.performance[0].won = 2;
    const errs = crossCheck(e, []);
    expect(errs.map(x => x.split(' ')[0])).toEqual(expect.arrayContaining(['electors:2', 'total-valid:2', 'runner-up:2', 'margin:2', 'party-won:BJP', 'party-votes:INC']));
  });
  it('treats IND and "Independent" as the same party', () => {
    const e = election();
    e.seats[0].candidates[1].party = 'IND'; e.summaries[0].runnerUp!.party = 'Independent';
    e.performance = e.performance.filter(p => p.abbr !== 'INC');
    expect(crossCheck(e, [])).toEqual([]);
  });
  it('compares performance abbreviations ignoring case and spaces', () => {
    const e = election(); e.performance[0].abbr = 'bjp';
    expect(crossCheck(e, [])).toEqual([]);
  });
  it('accepts a summary without a NOTA line whose valid total includes NOTA (Puducherry 2016)', () => {
    const e = election(); e.summaries[0].nota = null; e.summaries[0].totalValid = 610;
    expect(crossCheck(e, [])).toEqual([]);
    e.summaries[0].totalValid = 611;
    expect(crossCheck(e, []).map(x => x.split(' ')[0])).toContain('total-valid:2');
  });
  it('sums a party listed in two performance sections', () => {
    const e = election();
    e.performance = [{ abbr: 'BJP', contested: 1, won: 1, votes: 400 }, { abbr: 'INC', contested: 0, won: 0, votes: 50 }, { abbr: 'INC', contested: 1, won: 0, votes: 150 }];
    expect(crossCheck(e, [])).toEqual([]);
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
  it('uses a new election\'s own reserved counts (Assam 2023: 9 SC, 19 ST)', () => {
    const e = json(); e.seats.forEach((s, i) => { s.phase = 1; s.type = i < 9 ? 'SC' : i < 28 ? 'ST' : 'GEN'; });
    const cfg = { ...electionOf('AS', 2026), seats: e.seats.length };
    expect(validateElection(e, cfg).filter(x => x.startsWith('reserved'))).toEqual([]);
    e.seats[0].type = 'GEN';
    expect(validateElection(e, cfg)).toEqual(expect.arrayContaining([expect.stringMatching(/^reserved: SC 8 \/ ST 19, expected 9 \/ 19/)]));
  });
  it('accepts a well-formed election (phase count per year)', () => {
    const e = json(); e.seats.forEach((s, i) => { s.phase = (i % 3) + 1; });
    expect(validateElection(e, electionOf('BR', 2020))).toEqual([]);
  });
  it('rejects two winners, wrong reservation counts, turnout out of range and wrong phase count', () => {
    const e = json();
    e.seats[0].candidates[1].status = 'WON';
    e.seats[50].type = 'SC';
    e.seats[60].turnout = 101;
    const errs = validateElection(e, electionOf('BR', 2020));
    expect(errs).toEqual(expect.arrayContaining([
      expect.stringMatching(/^winners:1/), expect.stringMatching(/^reserved:/), expect.stringMatching(/^turnout:61/), expect.stringMatching(/^phases:/),
    ]));
  });
  it('validateElection accepts a seat won unopposed and refuses a polled seat without turnout', () => {
    const e = { year: 2024, electionId: 'x', source: { title: '', url: '', retrieved: '' }, parties: [], seats: [] } as unknown as ElectionJson;
    const seat = (constNo: number, extra: object, votes: number[]) => ({ constNo, type: 'ST', electors: 100, voters: 50, turnout: 50, phase: 1, pollDate: '2024-04-19',
      candidates: votes.map((v, i) => ({ serial: i + 1, name: 'X', partyId: i ? 'INC' : 'BJP', sex: null, age: null, votes: v, status: i ? 'LOST' : 'WON' })), ...extra });
    e.seats = [seat(1, { voters: null, turnout: null, uncontested: true }, [0]), seat(2, { turnout: null }, [30, 20])] as never;
    const errs = validateElection(e, { ...electionOf('SK', 2024), seats: 2, newElection: { name: '', delimitation: '2008', resultDate: '', reserved: { sc: 0, st: 2 } } });
    expect(errs.filter(x => /turnout|tie|winner/.test(x))).toEqual(['turnout:2 null']);
  });
});
