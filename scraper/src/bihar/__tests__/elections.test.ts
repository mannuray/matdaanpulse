import { describe, it, expect } from 'vitest';
import { ELECTIONS, STATES, electionOf, electionsOf, parseState } from '../elections';

describe('election registry', () => {
  it('lists every state election once, with unique ids and prefixes', () => {
    expect(ELECTIONS).toHaveLength(4 + 15 + 5);
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
