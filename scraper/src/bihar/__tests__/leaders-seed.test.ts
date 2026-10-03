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
    expect(personExpr(people[1])).toBe("(SELECT person_id FROM candidates WHERE id = '11111111-1111-1111-1111-111111111111')");
  });
  it('emits always-idempotent inserts, a guarded link, fill-only updates and manifest watchlists', () => {
    const sql = emitLeadersSeed(f, people, ids);
    const always = sql.slice(0, sql.indexOf('\\if :seed_apply'));
    expect(always).toContain("INSERT INTO persons (id, name) VALUES\n  ('aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa', 'Nitish Kumar')\nON CONFLICT (id) DO NOTHING;");
    expect(always).toContain("('https://blob/persons/Q1/photo.jpg', 'https://commons/File:N.jpg', 'O''Brien', 'CC BY 4.0')");
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_leaders')");
    expect(sql).toContain("WHERE c.id IN ('22222222-2222-2222-2222-222222222222')");
    expect(sql).toContain('(SELECT count(*) FROM candidates c2 WHERE c2.person_id = c.person_id) = 1');
    expect(sql).toContain("photo_url = COALESCE(photo_url, 'https://blob/persons/Q1/photo.jpg')");
    expect(sql).toContain("date_of_birth = COALESCE(date_of_birth, '1951-03-01'::date)");
    expect(sql).toContain("'person_id', ((SELECT person_id FROM candidates WHERE id = '11111111-1111-1111-1111-111111111111'))::text");
    expect(sql).toContain("'const_id', 'BR_VS20_128_RAGHOPUR'");
    expect(sql).toContain("WHERE id = 'e20' AND manifest_url IS NOT NULL;");
    expect(sql).not.toMatch(/WHERE id = 'e25'/); // no entries that year
    expect(sql).not.toMatch(/metadata/);
  });
});
