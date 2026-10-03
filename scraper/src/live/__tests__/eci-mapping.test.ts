import { describe, it, expect } from 'vitest';
import { mapCandidates, mapParty, normName, seatStateFrom } from '../adapters/eci-mapping';

const parties = [
  { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP' }, { id: 'AITC', name: 'All India Trinamool Congress', abbreviation: 'AITC' },
  { id: 'IND', name: 'Independent', abbreviation: 'IND' }, { id: 'NOTA', name: 'None of the Above', abbreviation: 'NOTA' },
];
const seat = { const_id: 'WB_VS26_100_HABRA', const_no: 100, name: 'HABRA', type: 'GEN', state_id: 25, candidates: [
  { candidate_id: 'c1', name: 'DEBDAS MONDAL', party_id: 'BJP' }, { candidate_id: 'c2', name: 'Jyotipriya Mallick', party_id: 'AITC' },
  { candidate_id: 'c3', name: 'RAM DAS', party_id: 'IND' }, { candidate_id: 'c4', name: 'SHYAM DAS', party_id: 'IND' },
  { candidate_id: 'n', name: 'NOTA', party_id: 'NOTA' },
] };

describe('eci-mapping', () => {
  it('normName', () => expect(normName('  Jyoti-priya  MALLICK. ')).toBe('JYOTIPRIYA MALLICK'));
  it('mapParty: NOTA, IND, full name, abbreviation, alias, unknown', () => {
    expect(mapParty('None of the Above', parties, {})).toBe('NOTA');
    expect(mapParty('Independent', parties, {})).toBe('IND');
    expect(mapParty('Bharatiya Janata Party', parties, {})).toBe('BJP');
    expect(mapParty('All India Trinamool Congress - AITC', parties, {})).toBe('AITC');
    expect(mapParty('Trinamool', parties, { Trinamool: 'AITC' })).toBe('AITC');
    expect(mapParty('Some New Party', parties, {})).toBeNull();
  });
  it('mapCandidates: by name+party, then by unique party; independents need the name', () => {
    const eci = [
      { name: 'DEBDAS MONDOL', party: 'Bharatiya Janata Party', votes: 104645 },     // spelling differs: unique party
      { name: 'JYOTIPRIYA MALLICK', party: 'All India Trinamool Congress', votes: 73183 },
      { name: 'RAM DAS', party: 'Independent', votes: 900 }, { name: 'SHYAM DAS', party: 'Independent', votes: 800 },
      { name: 'None of the Above', party: 'None of the Above', votes: 1200 },
    ];
    expect(mapCandidates(seat, eci, parties, {})).toEqual({ votes: { c1: 104645, c2: 73183, c3: 900, c4: 800, n: 1200 } });
    const badInd = eci.map(c => c.name === 'SHYAM DAS' ? { ...c, name: 'SHYAM DASS' } : c);
    expect(mapCandidates(seat, badInd, parties, {})).toEqual({ reason: 'unmapped candidate SHYAM DASS (Independent)' });
    expect(mapCandidates(seat, eci.slice(0, 4), parties, {})).toEqual({ reason: 'missing candidates: NOTA' });
  });
  it('seatStateFrom', () => {
    expect(seatStateFrom('24/24', 'Result Declared')).toEqual({ state: 'declared', round: { current: 24, total: 24 } });
    expect(seatStateFrom('12/20', 'Counting In Progress')).toEqual({ state: 'counting', round: { current: 12, total: 20 } });
    expect(seatStateFrom('0/20', '')).toEqual({ state: 'not_started', round: { current: 0, total: 20 } });
    expect(seatStateFrom('', 'Countermanded')).toEqual({ state: 'countermanded', round: null });
    expect(seatStateFrom('3/20', 'Counting Adjourned')).toEqual({ state: 'adjourned', round: { current: 3, total: 20 } });
  });
});
