import { describe, it, expect } from 'vitest';
import { bioFor, emitLeadersSeed, personExpr, type ResolvedPerson } from '../leaders-seed';
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
