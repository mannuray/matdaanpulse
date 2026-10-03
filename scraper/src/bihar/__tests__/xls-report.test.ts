// scraper/src/bihar/__tests__/xls-report.test.ts
import { describe, it, expect } from 'vitest';
import { parseDetailedRows, parseSummaryRows, parsePartyListRows, parsePerformanceRows } from '../xls-report';

const H2020 = [' STATE/UT NAME ', ' AC NO. ', ' AC NAME ', ' CANDIDATE NAME ', ' SEX ', ' AGE ', ' CATEGORY ', ' PARTY ', ' SYMBOL ', ' GENERAL ', ' POSTAL ', ' TOTAL ', ' % VOTES POLLED ', ' TOTAL ELECTORS ', null];
const D2020 = [
  ['10 - Detailed Results', null], [null, null, null, null, null, null, null, null, null, ' VALID VOTES POLLED '], H2020,
  ['Bihar', 1, 'Valmikinagar', '1 Dhirendra Pratap Singh alias Rinku singh', 'MALE', 40, 'GENERAL', 'JD(U)', 'Arrow', 74777, 129, 74906, 38.3, 331874, null],
  ['Bihar', 1, 'Valmikinagar', '2 Rajesh Singh', 'MALE', 42, 'GENERAL', 'INC', 'Hand', 52952, 369, 53321, 27.2, 331874, null],
  ['Bihar', 1, 'Valmikinagar', '3 NOTA', '', '', '', 'NOTA', 'NOTA', 8088, 2, 8090, 4.1, 331874, null],
  [' TURNOUT ', ' TOTAL : ', '', '', '', '', '', '', '', 135817, 500, 136317, 41.1, '', null],
  ['Bihar', 2, 'Ramnagar', '1 Bhagirathi Devi', 'FEMALE', 60, 'SC', 'BJP', 'Lotus', 75000, '', 75000, 50, 300000, null],
  [' TURNOUT ', ' TOTAL : ', '', '', '', '', '', '', '', 75000, 0, 75000, 25, '', null],
];
const D2025 = [
  ['10 - Detailed Results'], [null], [null, null, null, null, null, null, null, null, null, 'TOTAL VALID VOTES POLLED + NOTA'],
  ['STATE/UT NAME', 'AC NO.', 'AC NAME', 'CANDIDATE NAME', 'GENDER', 'AGE', 'CATEGORY', 'PARTY', 'SYMBOL', 'GENERAL', 'POSTAL', 'TOTAL', 'OVER VALID VOTES + NOTA', 'OVER TOTAL ELECTORS', 'TOTAL ELECTORS'],
  ['Bihar', 2, 'RAMNAGAR (SC)', '1 Nand Kishor Ram', 'MALE', 50, 'SC', 'BJP', 'Lotus', 115000, 214, 115214, 50, 33, 340000],
  ['Bihar', 2, 'RAMNAGAR (SC)', '2 Nota', null, null, null, 'NOTA', 'NOTA', 6391, 9, 6400, 2.7, 1.9, 340000],
  ['TURN OUT', null, null, null, null, null, 'TOTAL:', null, null, 121391, 223, 121614, '-', 70.49, null],
];

describe('parseDetailedRows', () => {
  it('reads 2020 seats, trimming cells, keeping NOTA apart and treating blank postal as 0', () => {
    const seats = parseDetailedRows(D2020);
    expect(seats).toHaveLength(2);
    expect(seats[0]).toMatchObject({ constNo: 1, acName: 'Valmikinagar', type: null, electors: 331874, nota: 8090, totalVotes: 136317 });
    expect(seats[0].candidates).toEqual([
      { serial: 1, name: 'Dhirendra Pratap Singh alias Rinku singh', sex: 'M', age: 40, party: 'JD(U)', general: 74777, postal: 129, total: 74906 },
      { serial: 2, name: 'Rajesh Singh', sex: 'M', age: 42, party: 'INC', general: 52952, postal: 369, total: 53321 },
    ]);
    expect(seats[1].candidates[0]).toMatchObject({ sex: 'F', postal: 0, total: 75000 });
  });
  it('reads 2025 seats with the reservation in the AC name', () => {
    const [s] = parseDetailedRows(D2025);
    expect(s).toMatchObject({ constNo: 2, acName: 'RAMNAGAR', type: 'SC', electors: 340000, nota: 6400, totalVotes: 121614 });
    expect(s.candidates).toHaveLength(1);
  });
  it('fails when a seat has no TURNOUT row', () => {
    expect(() => parseDetailedRows(D2020.slice(0, 5))).toThrow(/no TURNOUT row/);
  });
});

const S2020 = [
  ['8 - CONSTITUENCY DATA - SUMMARY'], ['State/UT', 'S04-Bihar', 'Constituency Name', '2-Ramnagar-SC'],
  ['I. Candidates', null, 'Men', 'Woman', 'Third Gender', 'Total'], [null, '4. Contested', 11, 1, 0, 12],
  ['II. Electors'], [null, '4. Total', 178445, 153395, 34, 331874],
  ['III. VOTERS'], [null, '4. Postal', null, null, null, 885], [null, '5. Total', 95628, 99278, 0, 195791],
  ['III. Polling Percentage', null, null, null, null, 59],
  ['IV. Votes'], [null, '3.Total valid votes polled on evm', null, null, null, 186818], [null, '7. Total Valid Votes Polled', null, null, null, 187399],
  [null, "9. VOTES POLLED FOR 'NOTA' (INCLUDING POSTAL)", null, null, null, 8090],
  ['VI. Dates'], [null, 'Polling', null, 'Counting', null, 'Declaration Of Result'], [null, '2020-11-07', null, '2020-11-10', null, '2020-11-10'],
  ['VII. Result'], [null, null, null, 'Party', 'Candidate', 'Votes'],
  [null, 'Winner', null, 'Bharatiya Janata Party', 'Bhagirathi Devi', 75423], [null, 'Runner-Up', null, 'Indian National Congress', 'Rajesh Ram', 59627],
  [null, 'Margin', null, 15796, '( 8.48 % of Total Votes)', null],
];

describe('parseSummaryRows', () => {
  it('reads the 2020 summary sheet', () => {
    expect(parseSummaryRows(S2020)).toEqual({
      constNo: 2, name: 'Ramnagar', type: 'SC', electors: 331874, voters: 195791, contested: 12, totalValid: 187399, nota: 8090,
      pollDate: '2020-11-07', winner: { party: 'Bharatiya Janata Party', name: 'Bhagirathi Devi', votes: 75423 },
      runnerUp: { party: 'Indian National Congress', name: 'Rajesh Ram', votes: 59627 }, margin: 15796,
    });
  });
  it('accepts the 2025 label form "2-RAMNAGAR-(SC)"', () => {
    const rows = S2020.map((r, i) => (i === 1 ? ['State/UT', 'S04-Bihar', 'Constituency Name', '2-RAMNAGAR-(SC)'] : r));
    expect(parseSummaryRows(rows)).toMatchObject({ constNo: 2, name: 'RAMNAGAR', type: 'SC' });
  });
});

describe('party list and performance', () => {
  it('reads the party list with recognition from section rows', () => {
    const rows = [
      ['3 - List Of Political Parties Participated'], [' PARTY TYPE ', ' ABBREVIATION ', ' PARTY '], [' NATIONAL PARTIES '],
      [1, 'BJP', 'Bharatiya Janata Party'], [' STATE PARTIES '], [7, 'JD(U)', 'Janata Dal  (United)'],
      [' STATE PARTIES - OTHER STATE '], [9, 'SHS', 'Shivsena'], [' REGISTERED(Unrecognised) PARTIES '], [20, 'JAPL', 'Jan Adhikar Party (Loktantrik)'],
    ];
    expect(parsePartyListRows(rows)).toEqual([
      { abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' },
      { abbr: 'JD(U)', name: 'Janata Dal (United)', recognition: 'State' },
      { abbr: 'SHS', name: 'Shivsena', recognition: 'State' },
      { abbr: 'JAPL', name: 'Jan Adhikar Party (Loktantrik)', recognition: 'Unrecognised' },
    ]);
  });
  it('reads party performance rows and skips subtotals', () => {
    const rows = [
      ['5 - Performance of Political Parties'], [null, null, 'SEATS'], ['PARTY TYPE', 'ABBREVIATION', 'CONTESTED', 'WON', 'FD', 'VOTES', '%'],
      ['NATIONAL PARTIES'], [1, 'BJP', 110, 74, 3, 8202067, '19.46%', 42.56], [null, null, 841, 96, 698, 9382666, '32.29'],
    ];
    expect(parsePerformanceRows(rows)).toEqual([{ abbr: 'BJP', contested: 110, won: 74, votes: 8202067 }]);
  });
});
