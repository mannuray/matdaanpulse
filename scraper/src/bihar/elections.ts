/**
 * Every state election the seeding pipeline handles: ids, seat-id prefixes, ECI report sources and files, expected
 * seats / reserved seats / poll dates (for validation), and the names of the generated seeds. Bihar keeps its
 * historical seed names so its output never changes.
 */
import type { SeatType } from './types';
import type { SeatRange } from './seat-range';

export type StateCode = 'BR' | 'WB' | 'TN' | 'KL' | 'AS' | 'PY' | 'GA' | 'MN' | 'PB' | 'UK' | 'UP' | 'DL' | 'HR' | 'JH' | 'OD' | 'SK' | 'AR' | 'AP';
export const STATE_CODES: StateCode[] = ['BR', 'WB', 'TN', 'KL', 'AS', 'PY', 'GA', 'MN', 'PB', 'UK', 'UP', 'DL', 'HR', 'JH', 'OD', 'SK', 'AR', 'AP'];

export interface YearConfig {
  year: number; electionId: string; constPrefix: string;
  source: { title: string; url: string };
  files: { pdf: string } | { detailed: string; summary: string; parties: string; performance: string };
}
export interface ElectionConfig extends YearConfig {
  state: StateCode;
  /** Distinct poll dates in the ECI schedule (validation). */
  expectedPhases: number;
  /** Seat count when it differs from the state's (e.g. postponed polls). */
  seats?: number;
  /** ECI old-site statistical report document id (fetch). */
  docid?: number;
  /** Seats the report leaves out (postponed polls); dropped when loading. */
  excludeSeats?: number[];
  /** ECI new-site statistical report category (`election-result?category_id=`; fetch). */
  category?: number;
  /** An election with no old seed: its elections row and constituencies are emitted from the registry and the report. */
  newElection?: { name: string; delimitation: string; resultDate: string; reserved?: { sc: number; st: number } };
  /** ECI results site of the election (candidate photos, winner cross-check). */
  resultsSite?: { base: string; eciCode: string };
  /** MyNeta (ADR) site slug for the winners' affidavits. */
  myneta?: string;
  /** Seat types fixed by the state (listed seats; the rest GEN), when its files label them inconsistently (Sikkim). */
  seatTypes?: Record<number, SeatType>;
  /** Drop a "Shri"/"Smt"/"Sri" prefix from candidate names (written on some names only, so they would not link). */
  stripHonorifics?: boolean;
  /** The report covers more seats than the state has today (Andhra 2009/2014): keep this range, renumbered. */
  seatRange?: SeatRange;
}
export interface StateConfig {
  code: StateCode; slug: string; name: string; stateId: number; seats: number; reserved: { sc: number; st: number };
  partiesSeed: string; correctionsSeed: string; linksSeed: string; linksSeedName: string; yearSeed: (year: number) => string;
  seatTypes?: Record<number, SeatType>;
  stripHonorifics?: boolean;
  /** Person links ignore word order and spaced initials (Telugu names: "Nara Chandrababu Naidu" / "Chandrababu Naidu Nara"). */
  looseNames?: boolean;
}

export const ECI_RESULTS_2026 = 'https://results.eci.gov.in/ResultAcGenMay2026/';
const OLD = (docid: number) => `https://www.eci.gov.in/eci-backend/public/api/old-site-statistical-report-data?docid=${docid}`;

const state = (code: StateCode, slug: string, name: string, stateId: number, seats: number, sc: number, st: number): StateConfig => ({
  code, slug, name, stateId, seats, reserved: { sc, st },
  partiesSeed: `seed_${slug}_vs_parties.sql`, correctionsSeed: `seed_${slug}_corrections_v1.sql`,
  linksSeed: `seed_${slug}_person_links_v1.sql`, linksSeedName: `seed_${slug}_person_links_v1`,
  yearSeed: y => `seed_${slug}_vs_${y}.sql`,
});

export const STATES: Record<StateCode, StateConfig> = {
  BR: { ...state('BR', 'bihar', 'Bihar', 5, 243, 38, 2),
    partiesSeed: 'seed_bihar_parties.sql', linksSeed: 'seed_bihar_person_links_v2.sql', linksSeedName: 'seed_bihar_person_links_v2' },
  WB: state('WB', 'wb', 'West Bengal', 36, 294, 68, 16),
  TN: state('TN', 'tn', 'Tamil Nadu', 31, 234, 44, 2),
  KL: state('KL', 'kl', 'Kerala', 16, 140, 14, 2),
  AS: state('AS', 'as', 'Assam', 4, 126, 8, 16),
  PY: state('PY', 'py', 'Puducherry', 27, 30, 5, 0),
  GA: state('GA', 'ga', 'Goa', 9, 40, 1, 0),
  MN: state('MN', 'mn', 'Manipur', 21, 60, 1, 19),
  PB: state('PB', 'pb', 'Punjab', 28, 117, 34, 0),
  UK: state('UK', 'uk', 'Uttarakhand', 35, 70, 13, 2),
  UP: state('UP', 'up', 'Uttar Pradesh', 34, 403, 84, 2),
  DL: state('DL', 'dl', 'Delhi', 24, 70, 12, 0),
  HR: state('HR', 'hr', 'Haryana', 11, 90, 17, 0),
  JH: state('JH', 'jh', 'Jharkhand', 14, 81, 9, 28),
  OD: state('OD', 'od', 'Odisha', 26, 147, 24, 33),
  // Bhutia-Lepcha (BL) seats are Scheduled Tribe seats; AC 32 Sangha (monastic electorate) is GEN. ECI's files label
  // these differently every year, so the types come from here (Phase 4B spec §3).
  SK: { ...state('SK', 'sk', 'Sikkim', 30, 32, 2, 12),
    seatTypes: { 1: 'ST', 5: 'ST', 6: 'ST', 8: 'SC', 9: 'ST', 16: 'ST', 18: 'SC', 21: 'ST', 23: 'ST', 24: 'ST', 27: 'ST', 29: 'ST', 30: 'ST', 31: 'ST' } },
  // Arunachal's 2009/2019 reports write "Shri" on some names only.
  AR: { ...state('AR', 'ar', 'Arunachal Pradesh', 3, 60, 0, 59), stripHonorifics: true },
  // Telugu names change word order and initials between reports: loose person-link keys.
  AP: { ...state('AP', 'ap', 'Andhra Pradesh', 2, 175, 29, 7), looseNames: true },
};

/** A historical election of one of the five states: ECI old-site report; 2011/2016 one PDF, 2021 XLSX (set after fetch). */
const hist = (code: StateCode, year: number, electionId: string, docid: number, expectedPhases: number, files?: YearConfig['files']): ElectionConfig => ({
  state: code, year, electionId, constPrefix: `${code}_VS${String(year).slice(2)}_`, expectedPhases, docid,
  source: { title: `ECI Statistical Report, ${STATES[code].name} Legislative Assembly ${year}`, url: OLD(docid) },
  files: files ?? { pdf: `${year}/report.pdf` },
});

/** A 2026 election: new-site statistical report (category), no old seed, results site for photos, MyNeta for affidavits. */
const y2026 = (code: StateCode, electionId: string, category: number, eciCode: string, myneta: string, expectedPhases: number,
  delimitation: string, reserved?: { sc: number; st: number }): ElectionConfig => ({
  state: code, year: 2026, electionId, constPrefix: `${code}_VS26_`, expectedPhases, category,
  source: { title: `ECI Statistical Report, ${STATES[code].name} Legislative Assembly 2026`, url: `https://www.eci.gov.in/eci-backend/public/api/election-result?category_id=${category}` },
  files: { detailed: '2026/10-Detailed_Results.xlsx', summary: '2026/8-Constituency_Data_Summery_Report.xlsx',
    parties: '2026/3-List_Of_Political_Parties_Participated.xlsx', performance: '2026/5-Performance_of_Political_Parties.xlsx' },
  newElection: { name: `${STATES[code].name} Vidhan Sabha 2026`, delimitation, resultDate: '2026-05-04', ...(reserved ? { reserved } : {}) },
  resultsSite: { base: ECI_RESULTS_2026, eciCode }, myneta,
});

/** A 2012-2022 election of a Phase 3A state: old-site report, no old seed (new-election path), its own reserved counts. */
const COUNTING: Record<number, string> = { 2012: '2012-03-06', 2017: '2017-03-11', 2022: '2022-03-10' };
const p3 = (code: StateCode, stateHex: string, year: number, docid: number, expectedPhases: number, reserved: { sc: number; st: number }, files: YearConfig['files']): ElectionConfig => ({
  ...hist(code, year, `a0${stateHex}0000-0000-4000-8000-00000000${year}`, docid, expectedPhases, files),
  newElection: { name: `${STATES[code].name} Vidhan Sabha ${year}`, delimitation: '2008', resultDate: COUNTING[year], reserved },
});
/** A Phase 4A election (2008-2025): old-site docid or new-site category, no old seed, its own counting date. */
const p4 = (code: StateCode, year: number, src: { docid: number } | { category: number }, expectedPhases: number, resultDate: string,
  files: YearConfig['files'], latest?: { base: string; eciCode: string; myneta: string }, extra: Partial<ElectionConfig> = {}): ElectionConfig => {
  const id = `a0${String(STATES[code].stateId).padStart(2, '0')}0000-0000-4000-8000-00000000${year}`;
  const base: ElectionConfig = 'docid' in src ? hist(code, year, id, src.docid, expectedPhases, files)
    : { state: code, year, electionId: id, constPrefix: `${code}_VS${String(year).slice(2)}_`, expectedPhases, category: src.category, files,
        source: { title: `ECI Statistical Report, ${STATES[code].name} Legislative Assembly ${year}`, url: `https://www.eci.gov.in/eci-backend/public/api/election-result?category_id=${src.category}` } };
  return { ...base, ...(STATES[code].seatTypes ? { seatTypes: STATES[code].seatTypes } : {}), ...(STATES[code].stripHonorifics ? { stripHonorifics: true } : {}), ...extra, newElection: { name: `${STATES[code].name} Vidhan Sabha ${year}`, delimitation: '2008', resultDate, reserved: STATES[code].reserved },
    ...(latest ? { resultsSite: { base: latest.base, eciCode: latest.eciCode }, myneta: latest.myneta } : {}) };
};
const pdf = (y: number) => ({ pdf: `${y}/${y}.pdf` });
/** ECI's report file names per set (they differ by state and year). */
const xs = (y: number, ext: 'xls' | 'xlsx', sep: '_' | '-', pre: '' | '0', summary: string) => ({
  detailed: `${y}/10-Detailed${sep}Results.${ext}`, summary: `${y}/${pre}8-${summary}.${ext}`,
  parties: `${y}/${pre}3-List${sep}Of${sep}Political${sep}Parties${sep}Participated.${ext}`, performance: `${y}/${pre}5-Performance${sep}of${sep}Political${sep}Parties.${ext}` });
const PDF12 = { pdf: '2012/2012.pdf' };
const x17 = { detailed: '2017/Detailed_Results.xlsx', summary: '2017/Constituency_Data_Summry.pdf', parties: '2017/List_Of_Political_Parties_Participated.xlsx', performance: '2017/Performance_of_Poltical_Parties.xlsx' };
/** 2022 report file names as ECI saved them (they differ by state). */
const x22 = (sep: '.' | '-', detailed: string, summary: string) => ({ detailed: `2022/${detailed}`, summary: `2022/${summary}`,
  parties: `2022/3${sep}List_Of_Political_Parties_Participated.xlsx`, performance: `2022/5${sep}Performance_of_Political_Parties.xlsx` });
const X22_DOT = x22('.', '10.Detailed_Results.xlsx', '8.Constituency_Data_Summary.xlsx');
const X22_DASH = x22('-', '10-Detailed_Results.xlsx', '8-Constituency_Data_Summery_Report.xlsx');

export const ELECTIONS: ElectionConfig[] = [
  { state: 'BR', year: 2010, electionId: 'a1b2c3d4-e5f6-7890-abcd-111111111010', constPrefix: 'BR_VS10_', expectedPhases: 6, docid: 3903,
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2010', url: OLD(3903) },
    files: { pdf: '2010/ECI_Statistical_Report_Bihar_AE_2010.pdf' } },
  { state: 'BR', year: 2015, electionId: 'a1b2c3d4-e5f6-7890-abcd-111111111015', constPrefix: 'BR_VS15_', expectedPhases: 5, docid: 3904,
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2015', url: OLD(3904) },
    files: { pdf: '2015/ECI_Statistical_Report_Bihar_AE_2015.pdf' } },
  { state: 'BR', year: 2020, electionId: 'b2c3d4e5-f6a7-8901-bcde-123456789020', constPrefix: 'BR_VS20_', expectedPhases: 3, docid: 12787,
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2020', url: OLD(12787) },
    files: { detailed: '2020/10_-_Detailed_Results.xls', summary: '2020/8_-_Constituency_Data_Summary.xlsx',
      parties: '2020/3_-_List_Of_Political_Parties_Participated.xls', performance: '2020/5-Performance_of_Political_Parties.xlsx' } },
  { state: 'BR', year: 2025, electionId: 'c3d4e5f6-a7b8-9012-cdef-234567890abc', constPrefix: 'BR_VS_', expectedPhases: 2, category: 16,
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2025', url: 'https://www.eci.gov.in/eci-backend/public/api/election-result?category_id=16' },
    files: { detailed: '2025/10-Detailed_Results.xlsx', summary: '2025/8-Constituency_Data_Summery_Report.xlsx',
      parties: '2025/3-List_Of_Political_Parties_Participated.xlsx', performance: '2025/5-Performance_of_Political_Parties.xlsx' } },
  hist('AS', 2011, 'f6a7b8c9-d0e1-2345-f012-567890122011', 4010, 2, { pdf: '2011/2011.pdf' }),
  hist('AS', 2016, 'f6a7b8c9-d0e1-2345-f012-567890122016', 4017, 2, { detailed: '2016/DETAILED_RESULTS.xlsx', summary: '2016/Constituency_Data_Summry.pdf',
    parties: '2016/List_Of_Political_Parties_Participated.xlsx', performance: '2016/Performance_of_Poltical_Parties.xlsx' }),
  hist('AS', 2021, 'f6a7b8c9-d0e1-2345-f012-567890122021', 13620, 3, { detailed: '2021/10._Detailed_Results.xlsx', summary: '2021/8._Constituency_Data_Summary.xlsx',
    parties: '2021/3._List_Of_Political_Parties_Participated.xlsx', performance: '2021/5._Performance_of_Political_Parties.xlsx' }),
  hist('KL', 2011, 'a7b8c9d0-e1f2-3456-0123-678901232011', 3763, 1, { pdf: '2011/2011.pdf' }),
  hist('KL', 2016, 'a7b8c9d0-e1f2-3456-0123-678901232016', 3767, 1, { detailed: '2016/Detailed_Results.xlsx', summary: '2016/Constituency_Data_Summry.pdf',
    parties: '2016/List_Of_Political_Parties_Participated.xlsx', performance: '2016/Performance_of_Poltical_Parties.xlsx' }),
  // ECI's download links for this report fail (HTTP 500); the four files were downloaded by hand from the same report.
  hist('KL', 2021, 'a7b8c9d0-e1f2-3456-0123-678901232021', 13827, 1, { detailed: '2021/10-Detailed_Results.xlsx', summary: '2021/8-Constituency_Data_Summary.xlsx',
    parties: '2021/3-List_Of_Political_Parties_Participated.xlsx', performance: '2021/5-Performance_of_Political_Parties.xlsx' }),
  hist('PY', 2011, 'b1c2d3e4-f5a6-7890-1234-567890ab2011', 3438, 1, { pdf: '2011/2011.pdf' }),
  hist('PY', 2016, 'b1c2d3e4-f5a6-7890-1234-567890ab2016', 3474, 1, { detailed: '2016/Detailed_Results.xlsx', summary: '2016/Constituency_Data_Summry.pdf',
    parties: '2016/List_Of_Political_Parties_Participated.xlsx', performance: '2016/Performance_of_Poltical_Parties.xlsx' }),
  hist('PY', 2021, 'b1c2d3e4-f5a6-7890-1234-567890ab2021', 13417, 1, { detailed: '2021/10-_Detailed_Results.xlsx', summary: '2021/8-_Constituency_Data_Summary.xlsx',
    parties: '2021/3-_List_Of_Political_Parties_Participated.xlsx', performance: '2021/5-Performance_of_Political_Parties.xlsx' }),
  hist('TN', 2011, 'e5f6a7b8-c9d0-1234-ef01-456789012011', 3340, 1, { pdf: '2011/2011.pdf' }),
  // Aravakurichi (134) and Thanjavur (174) were polled in Nov 2016; the report covers the 232 seats polled in May.
  { ...hist('TN', 2016, 'e5f6a7b8-c9d0-1234-ef01-456789012016', 3473, 1, { detailed: '2016/Detailed_Results.xlsx', summary: '2016/Constituency_Data_Summry.pdf',
    parties: '2016/List_Of_Political_Parties_Participated.xlsx', performance: '2016/Performance_of_Poltical_Parties.xlsx' }), seats: 232, excludeSeats: [134, 174] },
  hist('TN', 2021, 'e5f6a7b8-c9d0-1234-ef01-456789012021', 13680, 1, { detailed: '2021/10-_Detailed_Results.xlsx', summary: '2021/8-_Constituency_Data_Summary.xlsx',
    parties: '2021/3-_List_of_Political_Parties_Participated.xlsx', performance: '2021/5-_Performance_of_Political_Parties.xlsx' }),
  hist('WB', 2011, 'd4e5f6a7-b8c9-0123-def0-345678901011', 3195, 6, { pdf: '2011/2011.pdf' }),
  hist('WB', 2016, 'd4e5f6a7-b8c9-0123-def0-345678901016', 3469, 7, { detailed: '2016/Detailed_Results.xlsx', summary: '2016/Constituency_Data_Summry.pdf',
    parties: '2016/List_Of_Political_Parties_Participated.xlsx', performance: '2016/Performance_of_Poltical_Parties.xlsx' }),
  hist('WB', 2021, 'd4e5f6a7-b8c9-0123-def0-345678901021', 14106, 9, { detailed: '2021/10-Detailed_Results.xlsx', summary: '2021/8-Constituency_Data_Summary.xlsx',
    parties: '2021/3-List_Of_Political_Parties_Participated.xlsx', performance: '2021/5-Performance_of_Political_Parties.xlsx' }),
  // 2026: the ECI statistical reports (new site). Assam follows the 2023 delimitation (9 SC, 19 ST); West Bengal's set 28
  // includes AC 144 Falta (re-polled in May 2026), so its poll dates are two phases plus the re-poll.
  y2026('AS', 'f6a7b8c9-d0e1-2345-f012-567890122026', 23, 'S03', 'assam2026', 1, '2023', { sc: 9, st: 19 }),
  y2026('KL', 'a7b8c9d0-e1f2-3456-0123-678901232026', 24, 'S11', 'kerala2026', 1, '2008'),
  y2026('PY', 'b1c2d3e4-f5a6-7890-1234-567890ab2026', 25, 'U07', 'puducherry2026', 1, '2008'),
  y2026('TN', 'e5f6a7b8-c9d0-1234-ef01-456789012026', 26, 'S22', 'tamilnadu2026', 1, '2008'),
  y2026('WB', 'd4e5f6a7-b8c9-0123-def0-345678901026', 28, 'S25', 'westbengal2026', 3, '2008'),
  // Phase 3A (2012-2022). UP's reserved seats changed in 2017 (85 SC / 0 ST → 84 SC / 2 ST) within the 2008 delimitation.
  p3('GA', '09', 2012, 3856, 1, { sc: 1, st: 0 }, PDF12), p3('GA', '09', 2017, 3862, 1, { sc: 1, st: 0 }, x17), p3('GA', '09', 2022, 14168, 1, { sc: 1, st: 0 }, x22('.', '10-Detailed_Results_(9).xlsx', '8.Constituency_Data_Summary.xlsx')),
  p3('MN', '21', 2012, 3712, 1, { sc: 1, st: 19 }, PDF12), p3('MN', '21', 2017, 3713, 2, { sc: 1, st: 19 }, x17), p3('MN', '21', 2022, 14166, 2, { sc: 1, st: 19 }, X22_DOT),
  p3('PB', '28', 2012, 3455, 1, { sc: 34, st: 0 }, PDF12), p3('PB', '28', 2017, 3614, 1, { sc: 34, st: 0 }, x17), p3('PB', '28', 2022, 14165, 1, { sc: 34, st: 0 }, X22_DOT),
  p3('UK', '35', 2012, 3231, 1, { sc: 13, st: 2 }, PDF12), p3('UK', '35', 2017, 3470, 2, { sc: 13, st: 2 }, x17), p3('UK', '35', 2022, 14169, 1, { sc: 13, st: 2 }, X22_DASH),
  p3('UP', '34', 2012, 3262, 7, { sc: 85, st: 0 }, PDF12), p3('UP', '34', 2017, 3471, 8, { sc: 84, st: 2 }, x17), p3('UP', '34', 2022, 14185, 7, { sc: 84, st: 2 }, X22_DASH),
  // Phase 4A (since the 2008 delimitation; latest year = current track). OD 2019: AC 96 Patkura countermanded (polled later).
  p4('DL', 2008, { docid: 3876 }, 2, '2008-12-08', pdf(2008)), p4('DL', 2013, { docid: 3877 }, 1, '2013-12-08', pdf(2013)),
  p4('DL', 2015, { docid: 3878 }, 1, '2015-02-10', pdf(2015)), p4('DL', 2020, { docid: 12027 }, 1, '2020-02-11', xs(2020, 'xls', '_', '', 'Constituency_Data_Summery')),
  p4('DL', 2025, { category: 10 }, 1, '2025-02-08', xs(2025, 'xlsx', '_', '', 'Constituency_Data_Summery_Report'),
    { base: 'https://results.eci.gov.in/ResultAcGenFeb2025/', eciCode: 'U05', myneta: 'delhi2025' }),
  p4('HR', 2009, { docid: 3826 }, 1, '2009-10-22', pdf(2009)), p4('HR', 2014, { docid: 3827 }, 1, '2014-10-19', pdf(2014)),
  p4('HR', 2019, { docid: 11697 }, 1, '2019-10-24', xs(2019, 'xls', '_', '0', 'Constituency_Data_Summery_Report')),
  p4('HR', 2024, { category: 6 }, 1, '2024-10-08', xs(2024, 'xlsx', '-', '', 'Constituency-Data-Summery-Report'),
    { base: 'https://results.eci.gov.in/AcResultGenOct2024/', eciCode: 'S07', myneta: 'haryana2024' }),
  p4('JH', 2009, { docid: 3786 }, 5, '2009-12-23', pdf(2009)), p4('JH', 2014, { docid: 3787 }, 5, '2014-12-23', pdf(2014)),
  p4('JH', 2019, { docid: 11813 }, 5, '2019-12-23', xs(2019, 'xls', '_', '0', 'Constituency_Data_Summery')),
  p4('JH', 2024, { category: 9 }, 2, '2024-11-23', xs(2024, 'xlsx', '_', '', 'Constituency_Data_Summery_Report'),
    { base: 'https://results.eci.gov.in/ResultAcGenNov2024/', eciCode: 'S27', myneta: 'jharkhand2024' }),
  p4('OD', 2009, { docid: 3630 }, 2, '2009-05-16', pdf(2009)), p4('OD', 2014, { docid: 3631 }, 2, '2014-05-16', pdf(2014)),
  p4('OD', 2019, { docid: 11679 }, 4, '2019-05-23', xs(2019, 'xls', '_', '', 'Constituency_Data_Summery_'), undefined, { seats: 146, excludeSeats: [96] }),
  p4('OD', 2024, { category: 4 }, 4, '2024-06-04', xs(2024, 'xlsx', '-', '', 'Constituency-Data-Summery-Report'),
    { base: 'https://results.eci.gov.in/AcResultGenJune2024/', eciCode: 'S18', myneta: 'odisha2024' }),
  // Phase 4B-1: Sikkim (fetch-cli saves ECI's 2019 names with spaces as underscores, as Odisha 2019).
  p4('SK', 2009, { docid: 3364 }, 1, '2009-05-16', pdf(2009)), p4('SK', 2014, { docid: 3365 }, 1, '2014-05-16', pdf(2014)),
  p4('SK', 2019, { docid: 11677 }, 1, '2019-05-23', xs(2019, 'xls', '_', '', 'Constituency_Data_Summery_')),
  p4('SK', 2024, { category: 5 }, 1, '2024-06-02', xs(2024, 'xlsx', '-', '', 'Constituency-Data-Summery-Report'),
    { base: 'https://results.eci.gov.in/AcResultGen2ndJune2024/', eciCode: 'S21', myneta: 'sikkim2024' }),
  // Phase 4B-2: Arunachal Pradesh (2024 counted with Sikkim on 2 June; same results site).
  p4('AR', 2009, { docid: 4039 }, 1, '2009-10-22', pdf(2009)), p4('AR', 2014, { docid: 4040 }, 1, '2014-05-16', pdf(2014)),
  p4('AR', 2019, { docid: 11675 }, 1, '2019-05-23', xs(2019, 'xls', '_', '', 'Constituency_Data_Summery_')),
  p4('AR', 2024, { category: 3 }, 1, '2024-06-02', xs(2024, 'xlsx', '-', '', 'Constituency-Data-Summery-Report'),
    { base: 'https://results.eci.gov.in/AcResultGen2ndJune2024/', eciCode: 'S02', myneta: 'arunachalpradesh2024' }),
  // Phase 4B-3: Andhra Pradesh. 2009/2014 reports cover the undivided state (294 seats): today's Andhra is 120-294.
  p4('AP', 2009, { docid: 4054 }, 2, '2009-05-16', pdf(2009), undefined, { seatRange: { from: 120, to: 294, offset: 119 } }),
  p4('AP', 2014, { docid: 4055 }, 1, '2014-05-16', pdf(2014), undefined, { seatRange: { from: 120, to: 294, offset: 119 } }),
  p4('AP', 2019, { docid: 11673 }, 1, '2019-05-23', xs(2019, 'xls', '_', '', 'Constituency_Data_Summery_')),
  p4('AP', 2024, { category: 2 }, 1, '2024-06-04', xs(2024, 'xlsx', '-', '', 'Constituency-Data-Summery-Report'),
    { base: 'https://results.eci.gov.in/AcResultGenJune2024/', eciCode: 'S01', myneta: 'andhrapradesh2024' }),
];

/** The registry entry of an election id. */
export function electionById(id: string): ElectionConfig {
  const e = ELECTIONS.find(x => x.electionId === id);
  if (!e) throw new Error(`election ${id} is not in the registry`);
  return e;
}

export function electionsOf(s: StateCode): ElectionConfig[] {
  return ELECTIONS.filter(e => e.state === s).sort((a, b) => a.year - b.year);
}

export function electionOf(s: StateCode, year: number): ElectionConfig {
  const e = ELECTIONS.find(x => x.state === s && x.year === year);
  if (!e) throw new Error(`no election ${s} ${year} in the registry`);
  return e;
}

export function parseState(arg: string | undefined): StateCode {
  const s = (arg ?? '').toUpperCase() as StateCode;
  if (!STATE_CODES.includes(s)) throw new Error(`state code required: one of ${STATE_CODES.join(', ')} (got "${arg ?? ''}")`);
  return s;
}
