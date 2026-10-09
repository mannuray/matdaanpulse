/** API fixtures shaped like the real responses (frontend/src/model/types). */
export const BASE = 'https://api.test/api/v1';
export const E_ID = '11111111-1111-4111-8111-111111111111';
export const LS_ID = '22222222-2222-4222-8222-222222222222';
export const P_ID = '33333333-3333-4333-8333-333333333333';
export const P2_ID = '44444444-4444-4444-8444-444444444444';
export const DL_ID = '55555555-5555-4555-8555-555555555555';

const bihar = { id: 5, name: 'Bihar', code: 'BR', total_assembly_seats: 243, total_ls_seats: 40 };

export const election = {
  id: E_ID, name: 'Bihar Vidhan Sabha 2025', type: 'VS', state_id: 5, state: bihar, year: 2025,
  status: 'Finalized', tentative_next_date: null, delimitation: '2008',
} as const;
export const lsElection = { ...election, id: LS_ID, name: 'Lok Sabha 2024', type: 'LS', year: 2024, state_id: null, state: null } as const;

export const manifest = {
  election_id: E_ID,
  draft: { alliances: [
    { id: 'NDA', name: 'NDA', color: '#f90', parties: ['BJP', 'JDU'] },
    { id: 'MGB', name: 'MGB', color: '#0a0', parties: ['RJD', 'INC'] },
  ] },
};

const tally = (party_id: string, party_name: string, won: number, leading = 0) => ({ party_id, party_name, color: '#888', won, leading });
export const alliances = [
  tally('BJP', 'Bharatiya Janata Party', 89), tally('JDU', 'Janata Dal (United)', 85),
  tally('RJD', 'Rashtriya Janata Dal', 25), tally('INC', 'Indian National Congress', 6), tally('AIMIM', 'AIMIM', 5),
];

export const seats = [
  { id: 'BR-124', election_id: E_ID, name: 'Lalganj', const_no: 124, type: 'SC' },
  { id: 'BR-123', election_id: E_ID, name: 'Hajipur', const_no: 123, type: 'GEN' },
];

export const results = [
  { const_id: 'BR-123', party_id: 'BJP', candidate_name: 'Awadhesh Singh', votes: 90000, status: 'WON', margin: 2340, person_id: P_ID },
  { const_id: 'BR-123', party_id: 'RJD', candidate_name: 'Dev Kumar Chaurasia', votes: 87660, status: 'LOST', margin: 0, person_id: P2_ID },
  { const_id: 'BR-124', party_id: 'INC', candidate_name: 'Some <Name> $&', votes: 50000, status: 'WON', margin: 1000, person_id: null },
];

const partyObj = (id: string, name: string) => ({ id, name, abbreviation: id, color: null, symbol_url: null, eci_symbol_url: null });
export const constituency = {
  id: 'BR-123', election_id: E_ID, name: 'Hajipur', const_no: 123, type: 'GEN', district_id: null, district: null,
  state_id: 5, state: bihar, voter_turnout: 58.2, phase: 1, total_electors: 300000, current_round: null, total_rounds: null,
  candidates: [
    { id: 'c2', name: 'Dev Kumar Chaurasia', party: partyObj('RJD', 'Rashtriya Janata Dal'), is_incumbent: false, votes: 87660, vote_share: 47.1, status: 'LOST', margin: 0, person_id: P2_ID },
    { id: 'c1', name: 'Awadhesh Singh', party: partyObj('BJP', 'Bharatiya Janata Party'), is_incumbent: true, votes: 90000, vote_share: 48.4, status: 'WON', margin: 2340, person_id: P_ID },
  ],
};

export const seatAnalysis = {
  id: 'a1', const_id: 'BR-123', election_id: E_ID, dominance: null, dominance_party: null, notes: null,
  data: { history: [{ year: 2020, party: 'BJP', family: 'BJP', candidate: 'Awadhesh Singh', person_id: P_ID, margin: 3000, vote_share: 49, runner_up: null, runner_up_party: null }] },
};

const contest = {
  party_color: null, party_symbol_url: null, party_eci_symbol_url: null, is_incumbent: false, vote_share: 48.4, margin: 2340,
};
export const person = {
  id: P_ID, name: 'Awadhesh Singh', photo_url: 'https://matdaanpulse-media.s3.ap-south-1.amazonaws.com/p.jpg',
  gender: 'M', education: null, date_of_birth: null,
  candidates: [
    { ...contest, id: 'c1', name: 'Awadhesh Singh', party_id: 'BJP', party_name: 'Bharatiya Janata Party', party_abbreviation: 'BJP',
      election_name: 'Bihar Vidhan Sabha 2025', election_year: 2025, election_type: 'VS', election_status: 'Finalized',
      election_id: E_ID, constituency_name: 'Hajipur', const_id: 'BR-123', votes: 90000, status: 'WON' },
    { ...contest, id: 'c0', name: 'Awadhesh Singh', party_id: 'BJP', party_name: 'Bharatiya Janata Party', party_abbreviation: 'BJP',
      election_name: 'Lok Sabha 2024', election_year: 2024, election_type: 'LS', election_status: 'Finalized',
      election_id: LS_ID, constituency_name: 'Hajipur PC', const_id: 'PC-1', votes: 1000, status: 'LOST' },
  ],
};

export const party = {
  id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#f90', symbol_url: null, eci_symbol_url: null,
  leader_name: null, founded_year: 1980, headquarters: null, website: 'https://www.bjp.org',
  wikipedia_url: 'https://en.wikipedia.org/wiki/Bharatiya_Janata_Party', description: null,
};

const recordRow = {
  delimitation: '2008', votes: 1, held: 0, gained: 0, lost: 0, split_gained: 0, split_lost: 0, largest: true, formed_government: true, family: [],
};
export const partyRecord = {
  party_id: 'BJP', lineage: [],
  elections: [
    { ...recordRow, election_id: E_ID, state_id: 5, state_code: 'BR', state_name: 'Bihar', year: 2025, date: '2025-11-14', contested: 101, won: 89, share: 20.1, seats_total: 243 },
    { ...recordRow, election_id: DL_ID, state_id: 7, state_code: 'DL', state_name: 'Delhi', year: 2025, date: '2025-02-08', contested: 68, won: 48, share: 45.6, seats_total: 70 },
  ],
};

export const parties = [party, { ...party, id: 'IND', name: 'Independent', abbreviation: 'IND' }, { ...party, id: 'CPI(M)', name: 'Communist Party of India (Marxist)', abbreviation: 'CPI(M)' }];

/** The backend's success envelope. */
export const ok = (data: unknown) => ({ success: true, data });

/** A fetch that answers `${BASE}${path}` from `routes` (wrapped in the envelope) and 404s anything else. */
export function apiFrom(routes: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    const path = url.startsWith(BASE) ? url.slice(BASE.length) : url;
    if (!(path in routes)) return new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }), { status: 404 });
    return new Response(JSON.stringify(ok(routes[path])), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}
