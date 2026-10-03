import { describe, it, expect } from 'vitest';
import { groupCandidacies, linkKey, emitLinksSeed, type Candidacy } from '../links';

const c = (candidateId: string, year: number, constNo: number, name: string, partyId: string): Candidacy => ({ candidateId, year, constNo, name, partyId });

describe('linkKey', () => {
  it('drops alias parts, punctuation and case', () => {
    expect(linkKey('Dhirendra Pratap Singh alias Rinku singh')).toBe(linkKey('DHIRENDRA PRATAP SINGH ALIAS RINKU SINGH'));
    expect(linkKey('Md. Kamran')).toBe('MD KAMRAN');
  });
});

describe('groupCandidacies', () => {
  it('links the same name in the same seat across years; party switch is medium', () => {
    const g = groupCandidacies([c('a', 2015, 9, 'Dhirendra Pratap Singh', 'IND'), c('b', 2020, 9, 'Dhirendra Pratap Singh', 'JDU'), c('x', 2020, 10, 'Dhirendra Pratap Singh', 'JDU')]);
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
  });
});
