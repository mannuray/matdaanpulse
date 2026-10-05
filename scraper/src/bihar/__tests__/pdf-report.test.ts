// scraper/src/bihar/__tests__/pdf-report.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseDetailedText, parseSummaryText, parsePartyListText, parsePerformanceText } from '../pdf-report';

const DETAILED_2015 = `
                           Election Commission of India- State Election, 2015 to the Legislative Assembly Of Bihar
                                            DETAILED RESULTS
                                                                                           VALID VOTES POLLED
                                                                                                                              % VOTES
           CANDIDATE NAME            SEX     AGE CATEGORY         PARTY SYMBOL              GENERAL         POSTAL TOTAL       POLLED


Constituency          1. Valmiki Nagar                                                   TOTAL ELECTORS :              295342

     1 DHIRENDRA PRATAP                 M     35      GEN           IND     Cauliflowe         66754         106     66860      36.17
       SINGH ALIAS RINKU SINGH                                                  r
     2 IRSHAD HUSSAIN                   M     39      GEN           INC        Hand            33106         174     33280      18.01
     7 None of the Above                                           NOTA        NOTA             6766            1     6767       3.66
    13 VISHNUDEO PRASAD                 M     33      GEN        CPI(ML)     Flag with          1466            0     1466       0.79
       YADAV                                                       (L)        Three
                                                                               Stars
 TURNOUT                                           TOTAL:                                     107712         281     107993      62.58

Constituency          2. Ramnagar (SC) (SC)                                              TOTAL ELECTORS :              250000

     1 BHAGIRATHI DEVI                  F     60      SC            BJP        Lotus           70000          100     70100      60.00
     7 PRIYA RANJAN PRASAD              M     70      GEN        SASAPT Television              1175            0     1175       0.75
       SRIVASTAVA
 TURNOUT                                           TOTAL:                                      71175         100      71275      28.51
`;

const DETAILED_2010 = `
Constituency          1. Valmiki Nagar                                               TOTAL ELECTORS :                 240418

     1 RAJESH SINGH                      M       37       GEN         JD(U)                  42272           17     42289      29.43

     2 MUKESH KUMAR KUSHWAHA             M       34       GEN         RJD                    27606           12     27618      19.22
 TURNOUT                                           TOTAL:                                     69878           29     69907      29.08
`;

describe('parseDetailedText', () => {
  it('reads 2015 seats with wrapped names and wrapped party abbreviations', () => {
    const seats = parseDetailedText(DETAILED_2015);
    expect(seats).toHaveLength(2);
    expect(seats[0]).toMatchObject({ constNo: 1, acName: 'Valmiki Nagar', type: null, electors: 295342, nota: 6767, totalVotes: 107993 });
    expect(seats[0].candidates.map(c => [c.name, c.party, c.total])).toEqual([
      ['DHIRENDRA PRATAP SINGH ALIAS RINKU SINGH', 'IND', 66860],
      ['IRSHAD HUSSAIN', 'INC', 33280],
      ['VISHNUDEO PRASAD YADAV', 'CPI(ML)(L)', 1466],
    ]);
    expect(seats[0].candidates[0]).toMatchObject({ serial: 1, sex: 'M', age: 35, general: 66754, postal: 106 });
    expect(seats[1]).toMatchObject({ constNo: 2, acName: 'Ramnagar', type: 'SC' });
    expect(seats[1].candidates[1]).toMatchObject({ name: 'PRIYA RANJAN PRASAD SRIVASTAVA', party: 'SASAPT', total: 1175 });
  });
  it('keeps an abbreviation written with spaces ("Aa S P", UP 2012) whole', () => {
    const text = DETAILED_2010.replace('     2 MUKESH KUMAR KUSHWAHA             M       34       GEN         RJD                    27606           12     27618      19.22',
      '     2 RAJESH KUMAR SAVITA               M       36       GEN         Aa S P                 27606           12     27618      19.22');
    expect(parseDetailedText(text)[0].candidates[1]).toMatchObject({ name: 'RAJESH KUMAR SAVITA', party: 'Aa S P', total: 27618 });
  });
  it('reads 2010 seats (no symbol column, no NOTA)', () => {
    const [s] = parseDetailedText(DETAILED_2010);
    expect(s.nota).toBeNull();
    expect(s.candidates.map(c => [c.name, c.party, c.total])).toEqual([['RAJESH SINGH', 'JD(U)', 42289], ['MUKESH KUMAR KUSHWAHA', 'RJD', 27618]]);
  });
  it('fails on a candidate line it cannot read inside a seat', () => {
    expect(() => parseDetailedText(DETAILED_2010.replace('M       37', 'X       37'))).toThrow(/candidate line/);
  });
});

const SUMMARY_2015 = `
     CONSTITUENCY :                   1- Valmiki Nagar
       4. CONTESTED                                           13                         1                         0                   14
II.    ELECTORS
       1. GENERAL(Other than OVERSEAS)                     155000                   140000                           0               295000
       4. TOTAL                                         155200                   140142                           0               295342
III. VOTERS
       1. GENERAL(Other than OVERSEAS)                     92536                    91824                          0               184360
       5. TOTAL                                                                                                                    184960
III(A). POLLING PERCENTAGE                         62.63
IV. VOTES
       3. TOTALVALID VOTES POLLED ON EVM                                                                                           177594
       5. POSTAL VOTES DEDUCTED(REJECTED POSTAL
       VOTES + POSTAL VOTES POLLED FOR 'NOTA')

                                                                                                                                      127
       7.TOTAL VALID VOTES POLLED                                                                                                  178067
       9.VOTES POLLED FOR 'NOTA' (INCLUDING POSTAL)                                                                                  6767
VI. DATES
                  POLLING                                           COUNTING                                 DECLARATION OF RESULT
                  01-Nov-2015                                       8-Nov-2015                               8-Nov-2015
VII. RESULT
                   PARTY                           CANDIDATE                                                              VOTES
WINNER             IND                             Dhirendra Pratap Singh Alias Rinku Singh                                66860
RUNNER-UP          INC                             Irshad Hussain                                                         33280
MARGIN              33580                ( 18.86%     of Total Valid Votes)
     CONSTITUENCY :                  2- Ramnagar (SC)
       4. CONTESTED                                           10                         0                         0                   10
II.    ELECTORS
       3. TOTAL                                         131469                   108949                           0               240418
III. VOTERS
       4. TOTAL                                                                                                                   143701
IV. VOTES
        3. TOTAL VALID VOTES POLLED                                                                                               143698
VI. DATES
                  POLLING                                          COUNTING                                 DECLARATION OF RESULT

                  28-Oct-2010                                     24-Nov-2010                              24-Nov-2010
VII. RESULT
WINNER             BJP                           Bhagirathi Devi                                                          51993
RUNNER-UP          RJD                           Narottam Ram                                                             20003
MARGIN              31990                ( 22.26%     of Total Valid Votes)
`;

describe('parseSummaryText header variants', () => {
  it('reads the "CONSTITUENCY :-  1 - Name" form (Puducherry 2016)', () => {
    const block = SUMMARY_2015.replace('     CONSTITUENCY :                   1- Valmiki Nagar', '     CONSTITUENCY :-                    1 - Mannadipet');
    expect(parseSummaryText(block)[0]).toMatchObject({ constNo: 1, name: 'Mannadipet' });
  });
});

describe('parseSummaryText', () => {
  it('reads 2015 and 2010 style summary blocks', () => {
    const [a, b] = parseSummaryText(SUMMARY_2015);
    expect(a).toEqual({ constNo: 1, name: 'Valmiki Nagar', type: 'GEN', electors: 295342, voters: 184960, contested: 14, totalValid: 178067, nota: 6767,
      pollDate: '2015-11-01', winner: { party: 'IND', name: 'Dhirendra Pratap Singh Alias Rinku Singh', votes: 66860 },
      runnerUp: { party: 'INC', name: 'Irshad Hussain', votes: 33280 }, margin: 33580 });
    expect(b).toMatchObject({ constNo: 2, name: 'Ramnagar', type: 'SC', electors: 240418, voters: 143701, totalValid: 143698, nota: null, pollDate: '2010-10-28' });
  });
});

const PARTIES_2010 = `
    PARTY TYPE     ABBREVIATION             PARTY
NATIONAL PARTIES
          1.       BJP                      Bharatiya Janata Party
          4.       CPM                      Communist Party of India (Marxist)
STATE PARTIES
          7.       JD(U)                    Janata Dal (United)
REGISTERED(Unrecognised) PARTIES
        20 .       ABJS                     Akhil Bharatiya Jan Sangh
                                            (Rashtriya)
     OTHER ABBREVIATIONS AND DESCRIPTION
          1.       IND                      Independent
`;

const PERFORMANCE_2010 = `
                         PERFORMANCE OF POLITICAL PARTIES
NATIONAL PARTIES
   1.   BJP                            102              91           2            4790436              16.49%      39.56
   2 .  BSP                            239               0          236           933947                  3.21%    3.27
                                       841              96          698           9382666               32.29
159.    NOTA           243           0     243       947279                  2.48%    2.49
                         CANDIDATE DATA SUMMARY
   1.   NOT                            1                1            1            1
`;

describe('party list and performance (PDF)', () => {
  it('reads the party list and joins wrapped names, stopping at the next section', () => {
    expect(parsePartyListText(PARTIES_2010)).toEqual([
      { abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' },
      { abbr: 'CPM', name: 'Communist Party of India (Marxist)', recognition: 'National' },
      { abbr: 'JD(U)', name: 'Janata Dal (United)', recognition: 'State' },
      { abbr: 'ABJS', name: 'Akhil Bharatiya Jan Sangh (Rashtriya)', recognition: 'Unrecognised' },
    ]);
  });
  it('reads party performance until the next section', () => {
    expect(parsePerformanceText(PERFORMANCE_2010)).toEqual([
      { abbr: 'BJP', contested: 102, won: 91, votes: 4790436 },
      { abbr: 'BSP', contested: 239, won: 0, votes: 933947 },
    ]);
  });
});

describe('parsePartyListText with a letter-spaced abbreviation', () => {
  it('reads "Aa S P" (UP 2012) as one abbreviation', () => {
    const text = ['  PARTY TYPE         ABBREVIATION          PARTY', 'REGISTERED(Unrecognised) PARTIES',
      '        20 .         ASP                      Adarsh Samaj Party', '', '        21 .         Aa S P                   Asankhya Samaj Party'].join('\n');
    expect(parsePartyListText(text).map(p => p.abbr)).toEqual(['ASP', 'Aa S P']);
  });
});

describe('parseSummaryText with sourced fixes (ECI pages with broken figures)', () => {
  const block = [
    '                                          CONSTITUENCY DATA - SUMMARY',
    '     CONSTITUENCY :-                    11 - Sagolband (GEN)',
    'I. CANDIDATES', '       4. CONTESTED                                       5          0          0          5',
    'II. ELECTORS', '       4. TOTAL                                          10831                    12233                          0         23064',
    'III. VOTERS', '       4. TOTAL                                                                                                                  0',
    'IV. VOTES', '       3. TOTAL VALID VOTES POLLED                                                                                           (14)',
    'VI. DATES', '  POLLING              COUNTING', '  04-Mar-2017          11-Mar-2017',
    'WINNER        BJP      R.K. IMO             8000', 'RUNNER-UP     INC      SOMEONE              6000', 'MARGIN                       2000',
  ].join('\n');
  it('fails on the broken page without a fix', () => {
    expect(() => parseSummaryText(block)).toThrow(/Sagolband.*totalValid not found/);
  });
  it('takes a corrected seat type from the fix (ECI pages with an outdated reservation)', () => {
    expect(parseSummaryText(block, { 11: { voters: 18897, totalValid: 18883, type: 'ST' } })[0].type).toBe('ST');
  });
  it('takes voters and total valid votes from the fix for that seat only', () => {
    const [s] = parseSummaryText(block, { 11: { voters: 18897, totalValid: 18883 } });
    expect(s).toMatchObject({ constNo: 11, electors: 23064, voters: 18897, totalValid: 18883, margin: 2000 });
  });
});

// DL 2008 (pre-NOTA): rows lead with the Form-7 serial then the rank; "TOTAL:" and "Turn Out" are separate lines.
const DL2008 = `
Constituency              1. Nerela                                                      TOTAL ELECTORS :                     192649

    3    1 JASWANT SINGH                      M      55        GEN         INC                   34662            0         34662      31.66
    4    2 SHARAD KUMAR                       M      33        GEN         BSP                   33827            3         33830      30.90
    6 10 VISHAL                               M      52        GEN         RWS                      437           0           437       0.40

                                                     TOTAL:                                     109489            5         109494       56.84
           Turn Out

Constituency              2. Burari                                                      TOTAL ELECTORS :                     190130

    5    1 SHRI KRISHAN                       M      51        GEN         BJP                   31997            9         32006      30.10

                                                     TOTAL:                                     32006            9         32006       30.10
           Turn Out
`;

describe('parseDetailedText, pre-NOTA layout (2008/2009)', () => {
  it('reads the Form-7 serial, drops the rank, and closes a seat on its TOTAL line', () => {
    const seats = parseDetailedText(DL2008);
    expect(seats.map(s => [s.constNo, s.acName, s.electors, s.totalVotes, s.nota])).toEqual([[1, 'Nerela', 192649, 109494, null], [2, 'Burari', 190130, 32006, null]]);
    expect(seats[0].candidates.map(c => [c.serial, c.name, c.sex, c.age, c.party, c.total])).toEqual([
      [3, 'JASWANT SINGH', 'M', 55, 'INC', 34662], [4, 'SHARAD KUMAR', 'M', 33, 'BSP', 33830], [6, 'VISHAL', 'M', 52, 'RWS', 437]]);
  });
});

describe('parseDetailedText, pre-NOTA page break inside a seat', () => {
  it('skips the repeated "CAND SL." / "as per form 7" header lines', () => {
    const text = DL2008.replace('    4    2 SHARAD KUMAR', 'CAND SL.\n                CANDIDATE NAME             SEX      AGE CATEGORY            PARTY           GENERAL\nas per form 7\n    4    2 SHARAD KUMAR');
    expect(parseDetailedText(text)[0].candidates.map(c => c.name)).toEqual(['JASWANT SINGH', 'SHARAD KUMAR', 'VISHAL']);
  });
});

describe('parseSummaryText, 2009 layout (indented WINNER / MARGIN)', () => {
  it('reads Jharkhand 2009 seat 1', () => {
    const text = fs.readFileSync(path.join(__dirname, 'fixtures/pdf-2009/jh2009-summary-1.txt'), 'utf8');
    expect(parseSummaryText(text)).toEqual([{ constNo: 1, name: 'Rajmahal', type: 'GEN', electors: 233547, voters: 136119, contested: 12, totalValid: 136118,
      nota: null, pollDate: '2009-11-25', winner: { party: 'BJP', name: 'Arun Mandal', votes: 51277 }, runnerUp: { party: 'JMM', name: 'Md. Tajuddin', votes: 40874 }, margin: 10403 }]);
  });
});

describe('parseSummaryText, Odisha 2009 spelling "RUNER-UP"', () => {
  it('reads the runner-up', () => {
    const text = fs.readFileSync(path.join(__dirname, 'fixtures/pdf-2009/jh2009-summary-1.txt'), 'utf8').replace('RUNNER-UP ', '     RUNER-UP ');
    expect(parseSummaryText(text)[0].runnerUp).toEqual({ party: 'JMM', name: 'Md. Tajuddin', votes: 40874 });
  });
});

// JH 2014: section 8 (Women Candidates) is headed "DETAILED RESULTS" too, but its header has no SEX / GENERAL column.
const JH2014_WOMEN = `
                                  DETAILED RESULTS
        CANDIDATE NAME                AGE CATEGORY PARTY SYMBOL                            POSTAL TOTAL         POLLED

Constituency      1. Rajmahal                                             TOTAL ELECTORS :               269959
    1 KRISHNA MAHTO                    44     GEN         JVM                                   2       1617       100.00
TURNOUT                                     TOTAL:                                              2        1617         0.60
`;
const JH2014_REAL = `
                                   DETAILED RESULTS
        CANDIDATE NAME           SEX AGE CATEGORY PARTY SYMBOL                  GENERAL POSTAL TOTAL             POLLED
Constituency       1. Rajmahal                                                TOTAL ELECTORS :            269959
    1 ANANT KUMAR OJHA            M     48       GEN         BJP          Lotus             70303     69     70372     37.89
TURNOUT                                     TOTAL:                                  70303     69     70372     68.80
`;

describe('parseDetailedText skips tables that are not the detailed results', () => {
  it('ignores a block whose header has no SEX column, and refuses a seat that still appears twice', () => {
    const seats = parseDetailedText(JH2014_WOMEN + JH2014_REAL);
    expect(seats.map(s => [s.constNo, s.candidates.map(c => c.name)])).toEqual([[1, ['ANANT KUMAR OJHA']]]);
    expect(() => parseDetailedText(JH2014_REAL + JH2014_REAL)).toThrow(/seat 1 appears twice/);
  });
});

describe('parseDetailedText, sex glued to the name (JH 2014)', () => {
  it('splits "BAJRANGI PRASAD YADAV M" into name and sex', () => {
    const text = JH2014_REAL.replace('    1 ANANT KUMAR OJHA            M     48       GEN         BJP          Lotus             70303     69     70372     37.89',
      '    3 BAJRANGI PRASAD YADAV M           43     GEN         IND     Auto-         70303          69      70372      9.67');
    expect(parseDetailedText(text)[0].candidates.map(c => [c.name, c.sex, c.age, c.party])).toEqual([['BAJRANGI PRASAD YADAV', 'M', 43, 'IND']]);
  });
});

describe('parseDetailedText, a wrapped party next to a wrapped symbol (JH 2014)', () => {
  it('"CPI(ML) Auto-" / "(L)  Rickshaw" → party CPI(ML)(L), symbol text not glued on', () => {
    const text = JH2014_REAL.replace('    1 ANANT KUMAR OJHA            M     48       GEN         BJP          Lotus             70303     69     70372     37.89',
      '   10 MANI ORAON                   M    44      ST       CPI(ML) Auto-             70303          69       70372      0.75\n                                                           (L)  Rickshaw');
    expect(parseDetailedText(text)[0].candidates.map(c => [c.name, c.party])).toEqual([['MANI ORAON', 'CPI(ML)(L)']]);
  });
});
