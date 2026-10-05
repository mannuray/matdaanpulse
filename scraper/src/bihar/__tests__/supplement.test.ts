import { describe, it, expect } from 'vitest';
import { applySupplement, parseEciResultsHtml, withoutSeats, withMissingSummaries } from '../supplement';
import type { RawElection } from '../types';

// Trimmed from the archived eciresults.nic.in page for Bihar 2015 seat 195 (Agiaon).
const HTML = `<html><head><style>.x{}</style></head><body>
<table><tr><td>Bihar-Agiaon</td></tr></table>
<table id="div1">
<tr><th>Candidate</th><th>Party</th><th>Votes</th></tr>
<tr><td>PRABHUNATH PRASAD</td><td>Janata Dal  (United)</td><td align="right">52276</td></tr>
<tr><td>SHIVESH KUMAR</td><td>Bharatiya Janata Party</td><td>37572</td></tr>
<tr><td>UPENDRA KUMAR</td><td>Independent</td><td>1493</td></tr>
<tr><td>None of the Above</td><td>None of the Above</td><td>4244</td></tr>
</table></body></html>`;

describe('parseEciResultsHtml', () => {
  it('reads the candidate / party / votes table', () => {
    expect(parseEciResultsHtml(HTML)).toEqual([
      { name: 'PRABHUNATH PRASAD', party: 'Janata Dal (United)', votes: 52276 },
      { name: 'SHIVESH KUMAR', party: 'Bharatiya Janata Party', votes: 37572 },
      { name: 'UPENDRA KUMAR', party: 'Independent', votes: 1493 },
      { name: 'None of the Above', party: 'None of the Above', votes: 4244 },
    ]);
  });
  it('fails on a page without the results table', () => {
    expect(() => parseEciResultsHtml('<html><body>Service unavailable</body></html>')).toThrow(/results table/);
  });
});

const raw = (): RawElection => ({
  year: 2015,
  parties: [{ abbr: 'JD(U)', name: 'Janata Dal (United)', recognition: 'State' }, { abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' }],
  seats: [],
  summaries: [{ constNo: 195, name: 'Agiaon', type: 'SC', electors: 270000, voters: 95700, contested: 3, totalValid: 91341, nota: 4244, pollDate: '2015-11-01',
    winner: { party: 'JD(U)', name: 'P', votes: 52276 }, runnerUp: { party: 'BJP', name: 'S', votes: 37572 }, margin: 14704 }],
  performance: [],
});

describe('applySupplement', () => {
  it('builds a missing seat from the supplement, the summary and the party list', () => {
    const out = applySupplement(raw(), [{ constNo: 195, source: 'https://web.archive.org/x', candidates: parseEciResultsHtml(HTML) }]);
    expect(out.seats).toEqual([{ constNo: 195, acName: 'Agiaon', type: 'SC', electors: 270000, nota: 4244, totalVotes: 95585, candidates: [
      { serial: 1, name: 'PRABHUNATH PRASAD', sex: null, age: null, party: 'JD(U)', general: 52276, postal: 0, total: 52276 },
      { serial: 2, name: 'SHIVESH KUMAR', sex: null, age: null, party: 'BJP', general: 37572, postal: 0, total: 37572 },
      { serial: 3, name: 'UPENDRA KUMAR', sex: null, age: null, party: 'IND', general: 1493, postal: 0, total: 1493 },
    ] }]);
  });
  it('never replaces a seat the report already has', () => {
    const r = raw();
    r.seats = [{ constNo: 195, acName: 'Agiaon', type: 'SC', electors: 1, nota: null, totalVotes: 0, candidates: [] }];
    expect(applySupplement(r, [{ constNo: 195, source: 'x', candidates: parseEciResultsHtml(HTML) }]).seats[0].electors).toBe(1);
  });
  it('fails on a party name that is not in the year\'s list', () => {
    expect(() => applySupplement(raw(), [{ constNo: 195, source: 'x', candidates: [{ name: 'A', party: 'Unknown Party', votes: 1 }] }])).toThrow(/Unknown Party/);
  });
});

describe('withoutSeats', () => {
  it('drops seats the report leaves out (postponed polls) from seats and summaries', () => {
    const r = raw();
    r.seats = [{ constNo: 134, acName: 'A', type: null, electors: 1, nota: null, totalVotes: 0, candidates: [] }, { constNo: 195, acName: 'B', type: null, electors: 1, nota: null, totalVotes: 0, candidates: [] }];
    const out = withoutSeats(r, [134]);
    expect(out.seats.map(s => s.constNo)).toEqual([195]);
    expect(out.summaries.map(s => s.constNo)).toEqual([195]);
    expect(withoutSeats(r, []).seats).toHaveLength(2);
  });
});

describe('withMissingSummaries (seats ECI\'s Constituency Data Summary leaves out)', () => {
  const raw = (): RawElection => ({ year: 2017, parties: [], performance: [], summaries: [],
    seats: [{ constNo: 141, acName: 'Dhaurahra', type: null, electors: 300000, nota: 900, totalVotes: 0, candidates: [
      { serial: 1, name: 'A', sex: 'M', age: 50, party: 'BJP', general: 100000, postal: 500, total: 100500 },
      { serial: 2, name: 'B', sex: 'M', age: 45, party: 'SP', general: 80000, postal: 200, total: 80200 }] }] });
  const fix = { 141: { name: 'Dhaurahra', type: 'GEN' as const, voters: 190000, pollDate: '2017-02-23', reason: 'r' } };
  it('builds the summary from the detailed seat and the sourced fix', () => {
    const [s] = withMissingSummaries(raw(), fix).summaries;
    expect(s).toEqual({ constNo: 141, name: 'Dhaurahra', type: 'GEN', electors: 300000, voters: 190000, contested: 2, totalValid: 100500 + 80200, nota: 900,
      pollDate: '2017-02-23', winner: { party: 'BJP', name: 'A', votes: 100500 }, runnerUp: { party: 'SP', name: 'B', votes: 80200 }, margin: 20300 });
  });
  it('leaves seats the summary has alone, and fails on a fix for a seat the report lacks', () => {
    const r = raw(); r.summaries = [{ ...withMissingSummaries(raw(), fix).summaries[0], voters: 1 }];
    expect(withMissingSummaries(r, fix).summaries.map(s => s.voters)).toEqual([1]);
    expect(() => withMissingSummaries(raw(), { 999: fix[141] })).toThrow(/seat 999 is not in the Detailed Results/);
  });
});
