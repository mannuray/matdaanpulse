import { describe, it, expect } from 'vitest';
import { groupCandidacies, linkKey, emitLinksSeed, onlyGroupsTouching, type Candidacy } from '../links';

const c = (candidateId: string, year: number, constNo: number, name: string, partyId: string, age: number | null = null): Candidacy => ({ candidateId, year, constNo, name, partyId, age });

describe('linkKey', () => {
  it('drops alias parts, punctuation and case', () => {
    expect(linkKey('Dhirendra Pratap Singh alias Rinku singh')).toBe(linkKey('DHIRENDRA PRATAP SINGH ALIAS RINKU SINGH'));
    expect(linkKey('Md. Kamran')).toBe('MD KAMRAN');
  });
});

describe('groupCandidacies', () => {
  it('links the same name in the same seat across years; party switch is medium', () => {
    const g = groupCandidacies([c('a', 2015, 9, 'Dhirendra Pratap Singh', 'IND', 35), c('b', 2020, 9, 'Dhirendra Pratap Singh', 'JDU', 40), c('x', 2020, 10, 'Dhirendra Pratap Singh', 'JDU', 40)]);
    expect(g).toEqual([{ key: 'DHIRENDRA PRATAP SINGH|9', confidence: 'medium', members: [expect.objectContaining({ candidateId: 'a' }), expect.objectContaining({ candidateId: 'b' })] }]);
  });
  it('same party every year is high', () => {
    expect(groupCandidacies([c('a', 2010, 1, 'Rajesh Singh', 'JDU'), c('b', 2015, 1, 'RAJESH SINGH', 'JDU')])[0].confidence).toBe('high');
  });
  it('marks common names with different parties or IND, and same-year duplicates, for review', () => {
    expect(groupCandidacies([c('a', 2010, 5, 'Anil Kumar', 'IND'), c('b', 2020, 5, 'Anil Kumar', 'IND')])[0].confidence).toBe('review');
    expect(groupCandidacies([c('a', 2010, 5, 'Anil Kumar', 'BSP'), c('b', 2020, 5, 'Anil Kumar', 'RJD')])[0].confidence).toBe('review');
    expect(groupCandidacies([c('a', 2010, 5, 'Anil Kumar', 'BJP'), c('b', 2020, 5, 'Anil Kumar', 'BJP')])[0].confidence).toBe('high');
    expect(groupCandidacies([c('a', 2020, 7, 'Ram Prasad', 'IND'), c('b', 2020, 7, 'Ram Prasad', 'BSP'), c('d', 2025, 7, 'Ram Prasad', 'BSP')])[0].confidence).toBe('review');
  });
  it('a party switch or an IND member needs every age to fit the years, else review', () => {
    expect(groupCandidacies([c('a', 2010, 3, 'Om Shanti Baba', 'IND'), c('b', 2015, 3, 'Om Shanti Baba', 'BED')])[0].confidence).toBe('review'); // ages unknown
    expect(groupCandidacies([c('a', 2010, 3, 'Om Shanti Baba', 'IND', 50), c('b', 2015, 3, 'Om Shanti Baba', 'IND', 55)])[0].confidence).toBe('medium');
    expect(groupCandidacies([c('a', 2010, 46, 'Alok Kumar', 'BSP', 30), c('b', 2020, 46, 'Alok Kumar', 'IND', 55)])[0].confidence).toBe('review'); // 25 years older in 10
  });
  it('same party every year stays high unless the ages contradict', () => {
    expect(groupCandidacies([c('a', 2010, 1, 'Rajesh Singh', 'JDU', null), c('b', 2015, 1, 'Rajesh Singh', 'JDU', 42)])[0].confidence).toBe('high');
    expect(groupCandidacies([c('a', 2010, 1, 'Rajesh Singh', 'JDU', 30), c('b', 2015, 1, 'Rajesh Singh', 'JDU', 60)])[0].confidence).toBe('review');
  });
  it('single-word names are never linked', () => {
    expect(groupCandidacies([c('a', 2020, 191, 'Siddharth', 'INC', 40), c('b', 2025, 191, 'Siddharth', 'INC', 45)])[0].confidence).toBe('review');
  });
  it('drops single-year groups', () => {
    expect(groupCandidacies([c('a', 2010, 1, 'X Y', 'BJP')])).toEqual([]);
  });
});

describe('emitLinksSeed', () => {
  it('is run-once, links high/medium groups only, anchors on the most-linked person and never moves curated or merged persons', () => {
    const sql = emitLinksSeed([
      { key: 'A|1', confidence: 'high', members: [c('11111111-1111-1111-1111-111111111111', 2010, 1, 'A', 'BJP'), c('22222222-2222-2222-2222-222222222222', 2015, 1, 'A', 'BJP')] },
      { key: 'B|2', confidence: 'review', members: [c('33333333-3333-3333-3333-333333333333', 2010, 2, 'B', 'IND'), c('44444444-4444-4444-4444-444444444444', 2015, 2, 'B', 'IND')] },
    ]);
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_person_links_v2')");
    expect(sql).toContain("(1, '11111111-1111-1111-1111-111111111111'), (1, '22222222-2222-2222-2222-222222222222')");
    expect(sql).not.toContain('33333333-3333-3333-3333-333333333333');
    expect(sql).toContain('ORDER BY g, n DESC, cid');
    expect(sql).toContain('AND m.n = 1');
    expect(sql).toContain("pm.duplicate->>'id' = m.pid::text OR pm.keeper_ref = m.pid");
    expect(sql).toContain("al.action = 'CANDIDATE_SPLIT' AND al.entity_type = 'candidate' AND al.entity_id = m.cid::text");
    expect(sql).toContain('pp.photo_url IS NOT NULL OR pp.bio IS NOT NULL OR pp.wikipedia_url IS NOT NULL OR pp.date_of_birth IS NOT NULL');
  });
});

describe('links across delimitations and the 2026 v2 seed', () => {
  it('never links candidacies across delimitations (same seat number, different boundaries)', () => {
    const a = { ...c('a', 2021, 33, 'Ram Das', 'BJP', 50), era: '2008' };
    const b = { ...c('b', 2026, 33, 'Ram Das', 'BJP', 55), era: '2023' };
    expect(groupCandidacies([a, b])).toEqual([]);
    expect(groupCandidacies([a, { ...b, era: '2008' }])).toHaveLength(1);
  });
  it('keeps only the groups that include a candidacy of the given year (the v2 seed adds 2026 only)', () => {
    const groups = groupCandidacies([c('a', 2016, 1, 'Ram Das', 'BJP', 40), c('b', 2021, 1, 'Ram Das', 'BJP', 45),
      c('x', 2021, 2, 'Sita Devi', 'INC', 40), c('y', 2026, 2, 'Sita Devi', 'INC', 45)]);
    expect(onlyGroupsTouching(groups, 2026).map(g => g.members.map(m => m.candidateId))).toEqual([['x', 'y']]);
  });
  it('names the state and years in the seed header', () => {
    expect(emitLinksSeed([], 'seed_kl_person_links_v2', 'Kerala VS 2011-2026')).toContain('across Kerala VS 2011-2026');
  });
});
