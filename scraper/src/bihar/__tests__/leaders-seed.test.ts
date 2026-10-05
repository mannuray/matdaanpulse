import { describe, it, expect } from 'vitest';
import { bioFor, candidacyOf, emitLeadersSeed, personExpr, pickCandidacy, priorCandidacies, type ResolvedPerson } from '../leaders-seed';
import type { LeadersFile } from '../leaders-data';

const f: LeadersFile = {
  people: [{ key: 'nk', name: 'Nitish Kumar', wikidata: 'Q1', candidacies: [] }, { key: 'ty', name: 'Tejashwi Yadav', wikidata: 'Q2', candidacies: [{ year: 2015, const_id: 'BR_VS15_128_RAGHOPUR' }, { year: 2020, const_id: 'BR_VS20_128_RAGHOPUR' }] }],
  elections: {
    '2010': { leaders: [{ key: 'nk', role: 'Chief Minister', party_id: 'JDU' }], cabinet: [], sources: ['s'] },
    '2015': { leaders: [{ key: 'nk', role: 'Chief Minister', party_id: 'JDU' }, { key: 'ty', role: 'Deputy Chief Minister', party_id: 'RJD' }], cabinet: [], sources: ['s'] },
    '2020': { leaders: [{ key: 'nk', role: 'Chief Minister', party_id: 'JDU' }, { key: 'ty', role: 'Leader of the Opposition', party_id: 'RJD' }], cabinet: [], sources: ['s'] },
    '2025': { leaders: [], cabinet: [], sources: ['s'] },
  },
};
const people: ResolvedPerson[] = [
  { key: 'nk', name: 'Nitish Kumar', candidateIds: [], fixedId: 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa', profile: { key: 'nk', wikidata: 'Q1', date_of_birth: '1951-03-01', gender: 'M', wikipedia_url: 'https://en.wikipedia.org/wiki/Nitish_Kumar', photo_url: 'https://blob/persons/Q1/photo.jpg', credit: { source_url: 'https://commons/File:N.jpg', author: "O'Brien", licence: 'CC BY 4.0' } } },
  { key: 'ty', name: 'Tejashwi Yadav', candidateIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'], fixedId: null, profile: null },
];
const ids = { '2010': 'e10', '2015': 'e15', '2020': 'e20', '2025': 'e25' };

describe('leaders seed', () => {
  it('writes bios from the curated roles', () => {
    expect(bioFor('nk', f)).toBe('Chief Minister of Bihar in the 2010, 2015 and 2020 governments.');
    expect(bioFor('ty', f)).toBe('Deputy Chief Minister of Bihar in the 2015 government; Leader of the Opposition after the 2020 election.');
  });
  it('addresses persons through a candidate, or a fixed id when seatless', () => {
    expect(personExpr(people[0])).toBe("'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa'::uuid");
    // the leader's best-linked person: most candidacies, then the lowest candidate id
    expect(personExpr(people[1])).toBe("(SELECT c.person_id FROM candidates c WHERE c.id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') ORDER BY (SELECT count(*) FROM candidates c2 WHERE c2.person_id = c.person_id) DESC, c.id LIMIT 1)");
  });
  it('emits always-idempotent inserts, a guarded link, fill-only updates and manifest watchlists', () => {
    const sql = emitLeadersSeed(f, people, ids);
    const always = sql.slice(0, sql.indexOf('\\if :seed_apply'));
    expect(always).toContain("INSERT INTO persons (id, name) VALUES\n  ('aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa', 'Nitish Kumar')\nON CONFLICT (id) DO NOTHING;");
    expect(always).toContain("('https://blob/persons/Q1/photo.jpg', 'https://commons/File:N.jpg', 'O''Brien', 'CC BY 4.0')");
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_leaders')");
    // every candidacy of the leader may move to the anchor: from a one-candidacy person, or from a person whose
    // candidacies all belong to this leader (a curated duplicate), never from a merge, a split or an admin profile
    expect(sql).toContain("WHERE c.id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')");
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM candidates c3 WHERE c3.person_id = c.person_id AND c3.id NOT IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'))");
    expect(sql).toContain("al.action = 'CANDIDATE_SPLIT'");
    expect(sql).toContain("photo_url = COALESCE(photo_url, 'https://blob/persons/Q1/photo.jpg')");
    expect(sql).toContain("date_of_birth = COALESCE(date_of_birth, '1951-03-01'::date)");
    expect(sql).toContain("'person_id', ((SELECT c.person_id FROM candidates c WHERE c.id IN (");
    expect(sql).toContain("'const_id', 'BR_VS20_128_RAGHOPUR'");
    // only a JSON manifest without watchlist entries is written; a draft gets the same lists
    expect(sql).toContain("WHERE id = 'e20' AND manifest_url LIKE '{%' AND CASE WHEN manifest_url LIKE '{%' THEN NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(manifest_url::jsonb->'watchlists', '[]'::jsonb)) w WHERE jsonb_array_length(COALESCE(w->'entries', '[]'::jsonb)) > 0) ELSE false END;");
    expect(sql).toContain("UPDATE elections SET manifest_draft = manifest_draft || jsonb_build_object('watchlists'");
    expect(sql).toContain("WHERE id = 'e20' AND jsonb_typeof(manifest_draft) = 'object' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(manifest_draft->'watchlists', '[]'::jsonb)) w WHERE jsonb_array_length(COALESCE(w->'entries', '[]'::jsonb)) > 0);");
    expect(sql).not.toMatch(/WHERE id = 'e25'/); // no entries that year
    expect(sql).not.toMatch(/metadata/);
  });
});

describe('emitLeadersSeed for another state', () => {
  const file: LeadersFile = { people: [{ key: 'vijay', name: 'Vijay', wikidata: null, candidacies: [] }] as unknown as LeadersFile['people'],
    elections: { '2026': { leaders: [{ key: 'vijay', role: 'Chief Minister', party_id: 'TVK' }], cabinet: [], sources: ['s'] } } };
  const people: ResolvedPerson[] = [{ key: 'vijay', name: 'Vijay', candidateIds: [], fixedId: '00000000-0000-0000-0000-000000000001', profile: null }];
  const sql = emitLeadersSeed(file, people, { '2026': 'e5f6a7b8-c9d0-1234-ef01-456789012026' },
    { stateId: 31, stateName: 'Tamil Nadu', slug: 'tn', seedName: 'seed_tn_leaders', years: ['2026'] });
  it('names the state, its seed and its years', () => {
    expect(sql).toContain("seed_runs WHERE name = 'seed_tn_leaders'");
    expect(sql).toContain('state_id = COALESCE(state_id, 31)');
    expect(sql).toContain('Chief Minister of Tamil Nadu in the 2026 government.');
    expect(sql).toContain("WHERE id = 'e5f6a7b8-c9d0-1234-ef01-456789012026'");
    expect(sql).not.toMatch(/Bihar/);
  });
});

describe('pickCandidacy', () => {
  const c = (name: string, status: 'WON' | 'LOST', serial: number) => ({ serial, name, partyId: 'X', sex: null, age: null, votes: 1, status });
  it('prefers the winner when two candidates share the leader\'s name (Maniktala: two "Tapas Roy")', () => {
    expect(pickCandidacy([c('Tapas Roy', 'LOST', 1), c('Tapas Roy', 'WON', 2)], 'Tapas Roy')!.serial).toBe(2);
  });
  it('ignores NOTA and returns null below the name threshold', () => {
    expect(pickCandidacy([c('NOTA', 'LOST', 3)], 'Tapas Roy')).toBeNull();
  });
});

describe('bioFor party posts and opposition chiefs', () => {
  const f = { people: [], elections: { '2026': { leaders: [
    { key: 'stalin', role: 'DMK President (former Chief Minister)', party_id: 'DMK' },
    { key: 'vijay', role: 'Chief Minister', party_id: 'TVK' },
    { key: 'rc', role: 'NDA chief ministerial face', party_id: 'BJP' }], cabinet: [], sources: ['s'] } } } as unknown as LeadersFile;
  const opts = { stateName: 'Tamil Nadu', years: ['2026'] };
  it('never places a party post in the government', () => {
    expect(bioFor('stalin', f, opts)).toBe('DMK President (former Chief Minister) at the 2026 election.');
    expect(bioFor('rc', f, opts)).toBe('NDA chief ministerial face at the 2026 election.');
  });
  it('keeps the government form for the Chief Minister', () => {
    expect(bioFor('vijay', f, opts)).toBe('Chief Minister of Tamil Nadu in the 2026 government.');
  });
});

describe('priorCandidacies (a 2026 leader\'s own 2011-2021 candidacies, any seat)', () => {
  const c = (year: number, constId: string, name: string, partyId: string, age: number | null) => ({ year, constId, name, partyId, age });
  const now = { year: 2026, age: 57 };
  it('finds the same name in the leader\'s party in each earlier year', () => {
    const got = priorCandidacies('M. K. Stalin', new Set(['DMK']), now, [c(2021, 'TN_VS21_13_KOLATHUR', 'M.K. Stalin', 'DMK', 52), c(2021, 'X', 'Stalin', 'IND', 40)]);
    expect(got).toEqual([{ year: 2021, const_id: 'TN_VS21_13_KOLATHUR' }]);
  });
  it('accepts a party switch only for a near-exact name unique in that year (Himanta: INC 2011, BJP since)', () => {
    expect(priorCandidacies('Himanta Biswa Sarma', new Set(['BJP']), now, [c(2011, 'AS_VS11_51_JALUKBARI', 'Himanta Biswa Sarma', 'INC', 42)]))
      .toEqual([{ year: 2011, const_id: 'AS_VS11_51_JALUKBARI' }]);
    expect(priorCandidacies('R. Kumar', new Set(['TVK']), now, [c(2021, 'A', 'R. Kumar', 'DMK', 52), c(2021, 'B', 'R. Kumar', 'IND', 33)])).toEqual([]);
  });
  it('rejects a match whose declared age contradicts the years', () => {
    expect(priorCandidacies('Ram Das', new Set(['BJP']), now, [c(2021, 'A', 'Ram Das', 'BJP', 30)])).toEqual([]);
  });
});

describe('priorCandidacies when the name is shared in the latest election', () => {
  it('links nothing (two BJP "Dilip Ghosh" in West Bengal 2026: Kharagpur Sadar and Bolpur)', () => {
    const c2011 = { year: 2011, constId: 'WB_VS11_286_BOLPUR', name: 'Ghosh Dilip', partyId: 'BJP', age: 48 };
    expect(priorCandidacies('Dilip Ghosh', new Set(['BJP']), { year: 2026, age: 61, namesakes: 1 }, [c2011])).toEqual([]);
  });
});

describe('priorCandidacies ignores honorifics in ECI names', () => {
  it('matches "Adv.Mons Joseph" (KECM, 2011) to Mons Joseph (KEC, 2026) as a near-exact unique name', () => {
    const c = (year: number, name: string, partyId: string, age: number) => ({ year, constId: `KL_${year}`, name, partyId, age });
    expect(priorCandidacies('Mons Joseph', new Set(['KEC']), { year: 2026, age: 61 },
      [c(2011, 'Adv.Mons Joseph', 'KECM', 46), c(2016, 'Adv. Mons Joseph', 'KECM', 51), c(2021, 'Adv. Mons Joseph', 'KEC', 56)]).map(x => x.year))
      .toEqual([2011, 2016, 2021]);
  });
});

describe('candidacyOf', () => {
  const c = (name: string, serial: number) => ({ serial, name, partyId: 'BJP', sex: null, age: null, votes: 1, status: 'WON' as const });
  it('matches on the ballot name when the candidacy gives one (Delhi 2013: Parvesh Verma ran as "Parvesh Sahib Singh")', () => {
    const seat = [c('Parvesh Sahib Singh', 1), c('Narinder Singh Sejwal', 2)];
    expect(candidacyOf(seat, 'Parvesh Verma', { year: 2013, const_id: 'X' })).toBeNull();
    expect(candidacyOf(seat, 'Parvesh Verma', { year: 2013, const_id: 'X', ballot_name: 'Parvesh Sahib Singh' })!.serial).toBe(1);
  });
});

describe('pickCandidacy prefers a candidate whose name holds every part of the leader\'s name', () => {
  const c = (name: string, serial: number) => ({ serial, name, partyId: 'X', sex: null, age: null, votes: 1, status: 'LOST' as const });
  it('Silli 2019: "Sudesh Mahto" is "Sudesh Kumar Mahto", not the closer-spelled "Umesh Mahto"', () => {
    expect(pickCandidacy([c('Umesh Mahto', 1), c('Sudesh Kumar Mahto', 2)], 'Sudesh Mahto')!.serial).toBe(2);
  });
});
