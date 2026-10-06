import { describe, it, expect } from 'vitest';
import { ELECTIONS, STATES, electionOf, electionsOf, parseState } from '../elections';

describe('election registry', () => {
  it('lists every state election once, with unique ids and prefixes', () => {
    expect(ELECTIONS).toHaveLength(4 + 15 + 5 + 15 + 17 + 4 + 4 + 4 + 4);
    expect(new Set(ELECTIONS.map(e => e.electionId)).size).toBe(ELECTIONS.length);
    expect(new Set(ELECTIONS.map(e => e.constPrefix)).size).toBe(ELECTIONS.length);
  });
  it('keeps Bihar exactly as before', () => {
    expect(electionsOf('BR').map(e => [e.year, e.electionId, e.constPrefix, e.expectedPhases])).toEqual([
      [2010, 'a1b2c3d4-e5f6-7890-abcd-111111111010', 'BR_VS10_', 6], [2015, 'a1b2c3d4-e5f6-7890-abcd-111111111015', 'BR_VS15_', 5],
      [2020, 'b2c3d4e5-f6a7-8901-bcde-123456789020', 'BR_VS20_', 3], [2025, 'c3d4e5f6-a7b8-9012-cdef-234567890abc', 'BR_VS_', 2],
    ]);
    expect(STATES.BR).toMatchObject({ stateId: 5, seats: 243, reserved: { sc: 38, st: 2 }, partiesSeed: 'seed_bihar_parties.sql', correctionsSeed: 'seed_bihar_corrections_v1.sql', linksSeedName: 'seed_bihar_person_links_v2' });
    expect(STATES.BR.yearSeed(2020)).toBe('seed_bihar_vs_2020.sql');
  });
  it('has the five states with their ids and seed names', () => {
    expect(electionOf('WB', 2021)).toMatchObject({ electionId: 'd4e5f6a7-b8c9-0123-def0-345678901021', constPrefix: 'WB_VS21_' });
    expect(electionOf('AS', 2011)).toMatchObject({ electionId: 'f6a7b8c9-d0e1-2345-f012-567890122011', constPrefix: 'AS_VS11_' });
    expect(STATES.TN).toMatchObject({ stateId: 31, seats: 234, reserved: { sc: 44, st: 2 }, correctionsSeed: 'seed_tn_corrections_v1.sql', linksSeedName: 'seed_tn_person_links_v1' });
    expect(STATES.KL.yearSeed(2016)).toBe('seed_kl_vs_2016.sql');
  });
  it('rejects unknown states and years', () => {
    expect(() => parseState('XX')).toThrow(/BR, WB, TN, KL, AS, PY/);
    expect(() => electionOf('KL', 2006)).toThrow(/KL 2006/);
  });
});

describe('2026 elections', () => {
  it('registers the five 2026 elections from the new-site reports with their own delimitation', () => {
    const as = electionOf('AS', 2026);
    expect(as).toMatchObject({ electionId: 'f6a7b8c9-d0e1-2345-f012-567890122026', constPrefix: 'AS_VS26_', category: 23,
      newElection: { delimitation: '2023', reserved: { sc: 9, st: 19 } }, resultsSite: { eciCode: 'S03' }, myneta: 'assam2026' });
    expect(electionOf('WB', 2026)).toMatchObject({ category: 28, resultsSite: { eciCode: 'S25' }, newElection: { delimitation: '2008' } });
    expect((['KL', 'PY', 'TN'] as const).map(s => electionOf(s, 2026).category)).toEqual([24, 25, 26]);
    expect(electionsOf('AS').map(e => e.year)).toEqual([2011, 2016, 2021, 2026]);
  });
  it('keeps every election id unique', () => {
    expect(new Set(ELECTIONS.map(e => e.electionId)).size).toBe(ELECTIONS.length);
  });
});

describe('Phase 3A states', () => {
  it('registers 15 new elections with their own reserved counts', () => {
    expect(electionsOf('UP').map(e => [e.year, e.docid, e.newElection?.reserved])).toEqual([
      [2012, 3262, { sc: 85, st: 0 }], [2017, 3471, { sc: 84, st: 2 }], [2022, 14185, { sc: 84, st: 2 }]]);
    expect(electionOf('GA', 2012)).toMatchObject({ electionId: 'a0090000-0000-4000-8000-000000002012', constPrefix: 'GA_VS12_',
      newElection: { delimitation: '2008', resultDate: '2012-03-06' } });
    expect((['GA', 'MN', 'PB', 'UK'] as const).map(s => electionsOf(s).map(e => e.docid))).toEqual([
      [3856, 3862, 14168], [3712, 3713, 14166], [3455, 3614, 14165], [3231, 3470, 14169]]);
  });
});

describe('Phase 4A states', () => {
  it('registers 17 new elections with their own counting dates and sources', () => {
    expect(electionsOf('DL').map(e => [e.year, e.docid ?? e.category, e.newElection?.resultDate])).toEqual([
      [2008, 3876, '2008-12-08'], [2013, 3877, '2013-12-08'], [2015, 3878, '2015-02-10'], [2020, 12027, '2020-02-11'], [2025, 10, '2025-02-08']]);
    expect((['HR', 'JH', 'OD'] as const).map(s => electionsOf(s).map(e => e.docid ?? e.category))).toEqual([
      [3826, 3827, 11697, 6], [3786, 3787, 11813, 9], [3630, 3631, 11679, 4]]);
    expect(electionOf('OD', 2019)).toMatchObject({ electionId: 'a0260000-0000-4000-8000-000000002019', constPrefix: 'OD_VS19_', expectedPhases: 4 });
    expect(electionOf('JH', 2024)).toMatchObject({ resultsSite: { base: 'https://results.eci.gov.in/ResultAcGenNov2024/', eciCode: 'S27' }, myneta: 'jharkhand2024',
      newElection: { reserved: { sc: 9, st: 28 } } });
  });
});

describe('Phase 4B Sikkim', () => {
  it('registers Sikkim 2009-2024 with its sources, dates and seat types', () => {
    expect(electionsOf('SK').map(e => [e.year, e.docid ?? e.category, e.newElection?.resultDate, e.expectedPhases])).toEqual([
      [2009, 3364, '2009-05-16', 1], [2014, 3365, '2014-05-16', 1], [2019, 11677, '2019-05-23', 1], [2024, 5, '2024-06-02', 1]]);
    expect(electionOf('SK', 2024)).toMatchObject({ electionId: 'a0300000-0000-4000-8000-000000002024', constPrefix: 'SK_VS24_',
      resultsSite: { base: 'https://results.eci.gov.in/AcResultGen2ndJune2024/', eciCode: 'S21' }, myneta: 'sikkim2024',
      newElection: { delimitation: '2008', reserved: { sc: 2, st: 12 } } });
    const types = Object.entries(STATES.SK.seatTypes!);
    expect(types.filter(([, t]) => t === 'ST').map(([n]) => Number(n))).toEqual([1, 5, 6, 9, 16, 21, 23, 24, 27, 29, 30, 31]);
    expect(types.filter(([, t]) => t === 'SC').map(([n]) => Number(n))).toEqual([8, 18]);
    expect(electionOf('SK', 2019).seatTypes).toBe(STATES.SK.seatTypes);
  });
});

describe('Phase 4B Arunachal', () => {
  it('registers Arunachal 2009-2024', () => {
    expect(electionsOf('AR').map(e => [e.year, e.docid ?? e.category, e.newElection?.resultDate])).toEqual([
      [2009, 4039, '2009-10-22'], [2014, 4040, '2014-05-16'], [2019, 11675, '2019-05-23'], [2024, 3, '2024-06-02']]);
    expect(electionOf('AR', 2024)).toMatchObject({ electionId: 'a0030000-0000-4000-8000-000000002024', constPrefix: 'AR_VS24_',
      resultsSite: { base: 'https://results.eci.gov.in/AcResultGen2ndJune2024/', eciCode: 'S02' }, myneta: 'arunachalpradesh2024' });
  });
});

describe('Phase 4B Andhra Pradesh', () => {
  it('registers Andhra 2009-2024; 2009/2014 keep the undivided report\'s seats 120-294 as 1-175', () => {
    expect(electionsOf('AP').map(e => [e.year, e.docid ?? e.category, e.newElection?.resultDate, e.seatRange ?? null])).toEqual([
      [2009, 4054, '2009-05-16', { from: 120, to: 294, offset: 119 }], [2014, 4055, '2014-05-16', { from: 120, to: 294, offset: 119 }],
      [2019, 11673, '2019-05-23', null], [2024, 2, '2024-06-04', null]]);
    expect(electionOf('AP', 2024)).toMatchObject({ electionId: 'a0020000-0000-4000-8000-000000002024', constPrefix: 'AP_VS24_',
      resultsSite: { base: 'https://results.eci.gov.in/AcResultGenJune2024/', eciCode: 'S01' } });
  });
});

describe('Phase 4B Maharashtra', () => {
  it('registers Maharashtra 2009-2024', () => {
    expect(electionsOf('MH').map(e => [e.year, e.docid ?? e.category, e.newElection?.resultDate])).toEqual([
      [2009, 3724, '2009-10-22'], [2014, 3726, '2014-10-19'], [2019, 11699, '2019-10-24'], [2024, 8, '2024-11-23']]);
    expect(electionOf('MH', 2024)).toMatchObject({ electionId: 'a0200000-0000-4000-8000-000000002024', constPrefix: 'MH_VS24_',
      resultsSite: { base: 'https://results.eci.gov.in/ResultAcGenNov2024/', eciCode: 'S13' }, newElection: { reserved: { sc: 29, st: 25 } } });
  });
});
