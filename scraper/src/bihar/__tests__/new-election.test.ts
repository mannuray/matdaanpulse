import { describe, expect, it } from 'vitest';
import { constIdFor, newElectionSeed } from '../new-election';
import { electionOf } from '../elections';
import type { ElectionJson } from '../types';

const json = { year: 2026, electionId: 'f6a7b8c9-d0e1-2345-f012-567890122026', source: { title: 't', url: 'u', retrieved: '2026-10-03' }, parties: [],
  seats: [{ constNo: 33, name: 'Dispur', type: 'GEN', electors: 244988, voters: 1, turnout: 1, phase: 1, pollDate: '2026-04-09', candidates: [] },
          { constNo: 1, name: 'Gossaigaon', type: 'GEN', electors: 1, voters: 1, turnout: 1, phase: 1, pollDate: '2026-04-09', candidates: [] }] } as unknown as ElectionJson;

describe('constIdFor', () => {
  it('upper-cases the name and joins words with _ (the legacy id convention)', () => {
    expect(constIdFor('AS_VS26_', 33, 'Dispur')).toBe('AS_VS26_33_DISPUR');
    expect(constIdFor('KL_VS26_', 1, "Ma'njeshwar (SC)")).toBe('KL_VS26_1_MANJESHWAR_SC');
  });
});

describe('newElectionSeed', () => {
  const seed = newElectionSeed(electionOf('AS', 2026), json, '{"alliances":[]}');
  it('inserts the election as Finalized with its delimitation and counting date', () => {
    expect(seed.electionSql).toBe("INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date, delimitation) VALUES ('f6a7b8c9-d0e1-2345-f012-567890122026', 'Assam Vidhan Sabha 2026', 'VS', 4, 2026, 'Finalized', '2026-05-04', '2023') ON CONFLICT (id) DO NOTHING;");
  });
  it('lists every seat as a constituency with no old candidates', () => {
    expect(seed.constituencies).toEqual([{ id: 'AS_VS26_33_DISPUR', constNo: 33, name: 'Dispur' }, { id: 'AS_VS26_1_GOSSAIGAON', constNo: 1, name: 'Gossaigaon' }]);
    expect(seed.candidates).toEqual([]);
    expect(seed.manifestJson).toBe('{"alliances":[]}');
  });
  it('fails on a seat without a name', () => {
    expect(() => newElectionSeed(electionOf('AS', 2026), { ...json, seats: [{ ...json.seats[0], name: undefined }] } as ElectionJson, null)).toThrow(/seat 33 has no name/);
  });
});
