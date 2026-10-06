// scraper/src/bihar/__tests__/xls-report.test.ts
import { describe, it, expect } from 'vitest';
import { parseDetailedRows, parseSummaryRows, parsePartyListRows, parsePerformanceRows, performanceByAbbr } from '../xls-report';

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

describe('parseDetailedRows (flat layout, Puducherry 2016)', () => {
  const H = ['Constituency No.', 'Constituency Name', 'Candidate Name', 'Candidate Sex', 'Candidate Age', 'Candidate Category', ' Party Name', ' VALID VOTES POLLED in General', ' VALID VOTES POLLED in Postal', ' Total Valid Votes', 'Total Electors', 'Total Votes'];
  const rows = [['Detailed Results'], H,
    [1, 'Mannadipet', 'T.P.R. SELVAME', 'M', 44, 'GEN', 'AINRC', 7549, 130, 7679, 30709, 27560],
    [1, 'Mannadipet', 'A. KRISHNAN', 'M', 53, 'GEN', 'DMK', 7186, 74, 7260, 30709, 27560],
    [1, 'Mannadipet', 'None of the Above', null, null, null, 'NOTA', 300, 1, 301, 30709, 27560],
    [2, 'Thirubuvanai (SC)', 'B. KOBIGA', 'F', 30, 'SC', 'AINRC', 9000, 100, 9100, 31000, 25000],
  ];
  it('falls back to the sum of the parsed rows when a flat file has no Total Votes column', () => {
    const seats = parseDetailedRows(rows.map(r => r.slice(0, 11)));
    expect(seats.map(s => s.totalVotes)).toEqual([7679 + 7260 + 301, 9100]);
  });
  it('reads flat rows with alias headers, grouping seats by number when there are no TURNOUT rows', () => {
    const seats = parseDetailedRows(rows);
    expect(seats.map(s => [s.constNo, s.acName, s.type, s.electors, s.candidates.length, s.nota, s.totalVotes])).toEqual([
      [1, 'Mannadipet', null, 30709, 2, 301, 27560],
      [2, 'Thirubuvanai', 'SC', 31000, 1, null, 25000],
    ]);
    expect(seats[0].candidates[0]).toEqual({ serial: 1, name: 'T.P.R. SELVAME', sex: 'M', age: 44, party: 'AINRC', general: 7549, postal: 130, total: 7679 });
  });
});

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
    // a TURNOUT-style file (seat 1 closed) whose last seat has no closing row
    expect(() => parseDetailedRows(D2020.slice(0, 8))).toThrow(/no TURNOUT row/);
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

// DL 2020 "8-Constituency_Data_Summery.xls", sheet U05-1 (2019/2020 layout: plain section headings, labels in column A or B).
const S2020PLAIN = [
  ['CONSTITUENCY DATA  SUMMARY', '', '', '', '', '', ''],
  [' State/UT & Code ', 'U05', ' Constituency Name & Code ', 'NARELA-GEN', '', '', ''],
  [' CANDIDATES ', '', '', 'Men', 'Women', 'Others', 'Total'],
  ['', ' Nominated ', '', 15, 4, 0, 19], ['', ' Contested ', '', 9, 2, 0, 11], ['', ' Forfeited Deposit ', '', 7, 2, 0, 9],
  [' ELECTORS '], [' General ', 139968, 113734, 7, 253709], [' Service ', 256, 17, 0, 273], [' Total ', 140224, 113751, 7, 253982],
  [' VOTERS '], [' General ', 90936, 73920, 3, 164859], [' Postal ', 1104], [' Total', 165963],
  [' POLLING PERCENTAGE ', 65.34439448464852], [' VOTES '], [' Total Votes Polled On EVM ', 164859], [' Total Valid Votes polled on EVM ', 164113],
  [' Total Valid Votes Polled ', 164941], [" Votes Polled for 'NOTA'(Including Postal) ", 753],
  [' POLLING STATION '], [' Number ', 296, ' Average Electors Per Polling ', 858], [' DATES  ', '08/02/2020', '11/02/2020', '11/02/2020'], [],
  [' RESULT  ', ' Party  ', ' Candidates  ', ' Votes  '], [' Winner ', 'Aam Aadmi Party', 'SHARAD KUMAR', 86262],
  [' Runner-Up ', 'Bharatiya Janata Party', 'NEEL DAMAN KHATRI', 68833], [' Margin  ', 17429],
];

describe('parseSummaryRows', () => {
  it('reads the 2020 summary sheet', () => {
    expect(parseSummaryRows(S2020)).toEqual({
      constNo: 2, name: 'Ramnagar', type: 'SC', electors: 331874, voters: 195791, contested: 12, totalValid: 187399, nota: 8090,
      pollDate: '2020-11-07', winner: { party: 'Bharatiya Janata Party', name: 'Bhagirathi Devi', votes: 75423 },
      runnerUp: { party: 'Indian National Congress', name: 'Rajesh Ram', votes: 59627 }, margin: 15796,
    });
  });
  it('takes the seat number from the sheet name when the label has none (2019/2020 sets: sheet "U05-1", label "NARELA-GEN")', () => {
    const rows = S2020.map((r, i) => (i === 1 ? [r[0], r[1], r[2], 'NARELA-GEN', ...r.slice(4)] : r));
    expect(parseSummaryRows(rows, 'U05-1')).toMatchObject({ constNo: 1, name: 'NARELA', type: 'GEN' });
    expect(() => parseSummaryRows(rows)).toThrow(/unrecognised constituency label "NARELA-GEN"/);
  });
  it('reads Sikkim 2024 labels: "-(BL)" is ST, and Sangha carries no type (GEN)', () => {
    const at = (label: string) => S2020.map((r, i) => (i === 1 ? [r[0], r[1], r[2], label, ...r.slice(4)] : r));
    expect(parseSummaryRows(at('1-YUKSOM-TASHIDING-(BL)'))).toMatchObject({ constNo: 1, name: 'YUKSOM-TASHIDING', type: 'ST' });
    expect(parseSummaryRows(at('18-WEST PENDAM-(SC)'))).toMatchObject({ constNo: 18, name: 'WEST PENDAM', type: 'SC' });
    expect(parseSummaryRows(at('32-SANGHA'))).toMatchObject({ constNo: 32, name: 'SANGHA', type: 'GEN' });
  });
  it('reads the 2019/2020 plain layout (no roman section numbers)', () => {
    expect(parseSummaryRows(S2020PLAIN, 'U05-1')).toEqual({
      constNo: 1, name: 'NARELA', type: 'GEN', electors: 253982, voters: 165963, contested: 11, totalValid: 164941, nota: 753,
      pollDate: '2020-02-08', winner: { party: 'Aam Aadmi Party', name: 'SHARAD KUMAR', votes: 86262 },
      runnerUp: { party: 'Bharatiya Janata Party', name: 'NEEL DAMAN KHATRI', votes: 68833 }, margin: 17429,
    });
  });
  it('accepts the 2025 label form "2-RAMNAGAR-(SC)"', () => {
    const rows = S2020.map((r, i) => (i === 1 ? ['State/UT', 'S04-Bihar', 'Constituency Name', '2-RAMNAGAR-(SC)'] : r));
    expect(parseSummaryRows(rows)).toMatchObject({ constNo: 2, name: 'RAMNAGAR', type: 'SC' });
  });
});

describe('party list and performance (letter-typed layout, Puducherry 2016)', () => {
  it('reads "type letter, full name, abbreviation" party rows', () => {
    const rows = [['List OF Participating Political Parties'], ['Party Type', 'Party Name', 'Party Abbreviation'],
      ['N', 'Bharatiya Janata Party', 'BJP'], ['S', 'All India N.R. Congress', 'AINRC'], ['U', 'Naam Tamilar Katchi', 'NTK']];
    expect(parsePartyListRows(rows)).toEqual([
      { abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' },
      { abbr: 'AINRC', name: 'All India N.R. Congress', recognition: 'State' },
      { abbr: 'NTK', name: 'Naam Tamilar Katchi', recognition: 'Unrecognised' },
    ]);
  });
  it('reads performance rows keyed by full name and maps them to the list\'s abbreviations', () => {
    const rows = [['Performance Of Political Parties'], ['Party Type', 'Party Name', 'Contested', 'Won', 'Forfitted', 'Votes', 'Total Valid Votes'],
      ['N', 'Bharatiya Janata Party', 30, 0, 29, 19303, 800343], ['N', 'Indian National Congress', 21, 15, 2, 244886, 800343]];
    const perf = parsePerformanceRows(rows);
    expect(perf).toEqual([{ abbr: 'Bharatiya Janata Party', contested: 30, won: 0, votes: 19303 }, { abbr: 'Indian National Congress', contested: 21, won: 15, votes: 244886 }]);
    const list = [{ abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' as const }, { abbr: 'INC', name: 'Indian National  Congress', recognition: 'National' as const }];
    expect(performanceByAbbr(perf, list).map(p => p.abbr)).toEqual(['BJP', 'INC']);
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
  it('reads party performance rows and skips subtotals, NOTA and the grand total', () => {
    const rows = [
      ['5 - Performance of Political Parties'], [null, null, 'SEATS'], ['PARTY TYPE', 'ABBREVIATION', 'CONTESTED', 'WON', 'FD', 'VOTES', '%'],
      ['NATIONAL PARTIES'], [1, 'BJP', 110, 74, 3, 8202067, '19.46%', 42.56], [null, null, 841, 96, 698, 9382666, '32.29'],
      [214, 'NOTA', '-', '-', '-', 706295, '1.68%', 1.68], ['Grand Total:', null, 2616, 243, 2107, 50207733, '-', 100],
    ];
    expect(parsePerformanceRows(rows)).toEqual([{ abbr: 'BJP', contested: 110, won: 74, votes: 8202067 }]);
  });
});
