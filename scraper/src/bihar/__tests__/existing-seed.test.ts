// scraper/src/bihar/__tests__/existing-seed.test.ts
import { describe, it, expect } from 'vitest';
import { parseTuples, readExistingSeed } from '../existing-seed';

const SQL = `-- Bihar Vidhan Sabha 2010 Election Data
INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-111111111010', 'Bihar Vidhan Sabha 2010', 'VS', 5, 2010, 'Finalized', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO constituencies (id, election_id, district_id, state_id, name, const_no, type, voter_turnout, phase, total_electors) VALUES
  ('BR_VS10_1_VALMIKI_NAGAR', 'a1b2c3d4-e5f6-7890-abcd-111111111010', NULL, 5, 'Valmiki Nagar', 1, 'GEN', NULL, NULL, NULL),
  ('BR_VS10_2_RAMNAGAR', 'a1b2c3d4-e5f6-7890-abcd-111111111010', NULL, 5, 'Ramnagar', 2, 'GEN', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent) VALUES
  ('425b37f1-1ef2-4d0b-896a-d637694bbf62', NULL, 'a1b2c3d4-e5f6-7890-abcd-111111111010', 'BR_VS10_1_VALMIKI_NAGAR', 'JDU', 'Rajesh Singh', FALSE),
  ('6c11ea64-c8d2-451f-9367-86f346443a96', NULL, 'a1b2c3d4-e5f6-7890-abcd-111111111010', 'BR_VS10_1_VALMIKI_NAGAR', 'RJD', 'O''Brien, Mukesh', FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO results (id, candidate_id, const_id, votes, status, margin, round_no, election_id) VALUES
  ('478d66d8-a411-476e-96ba-7a832950fe3d', '425b37f1-1ef2-4d0b-896a-d637694bbf62', 'BR_VS10_1_VALMIKI_NAGAR', 64671, 'WON', 14671, 0, 'a1b2c3d4-e5f6-7890-abcd-111111111010'),
  ('db34d8dc-b26b-453e-965e-8d34ad4c307d', '6c11ea64-c8d2-451f-9367-86f346443a96', 'BR_VS10_1_VALMIKI_NAGAR', 50000, 'LOST', 14671, 0, 'a1b2c3d4-e5f6-7890-abcd-111111111010')
ON CONFLICT DO NOTHING;

-- Manifest
UPDATE elections SET manifest_url = '{"leaders":[{"name":"Nitish Kumar"}],"note":"it''s"}' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-111111111010';
`;

describe('existing seed reader', () => {
  it('parses SQL tuples with quotes, NULL, numbers and booleans', () => {
    expect(parseTuples("  ('a''b', NULL, 5, 'x', FALSE),")).toEqual(["a'b", null, 5, 'x', false]);
  });
  it('reads constituencies, candidates with their result ids, the election statement and the manifest', () => {
    const s = readExistingSeed(SQL);
    expect(s.constituencies).toEqual([
      { id: 'BR_VS10_1_VALMIKI_NAGAR', constNo: 1, name: 'Valmiki Nagar' }, { id: 'BR_VS10_2_RAMNAGAR', constNo: 2, name: 'Ramnagar' },
    ]);
    expect(s.candidates).toEqual([
      { id: '425b37f1-1ef2-4d0b-896a-d637694bbf62', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'JDU', name: 'Rajesh Singh', resultId: '478d66d8-a411-476e-96ba-7a832950fe3d' },
      { id: '6c11ea64-c8d2-451f-9367-86f346443a96', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'RJD', name: "O'Brien, Mukesh", resultId: 'db34d8dc-b26b-453e-965e-8d34ad4c307d' },
    ]);
    expect(s.electionSql).toMatch(/^INSERT INTO elections[\s\S]*ON CONFLICT \(id\) DO NOTHING;$/);
    expect(s.manifestJson).toBe('{"leaders":[{"name":"Nitish Kumar"}],"note":"it\'s"}');
  });
  it('fails when a candidate has no result row', () => {
    expect(() => readExistingSeed(SQL.replace(/\n  \('db34d8dc[^\n]*\n/, '\n'))).toThrow(/no result row/);
  });
});
