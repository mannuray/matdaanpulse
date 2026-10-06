import { describe, it, expect } from 'vitest';
import { emitLineageSeed, emitUnitsSeed, pickCandidate } from '../party-model';

const parties = new Set(['SHS', 'SSUBT', 'BJP', 'JVM']);
const states = new Map([['MH', 20], ['KL', 16], ['BR', 5]]);

describe('emitLineageSeed', () => {
  it('writes each event fill-only, resolving the state code', () => {
    const sql = emitLineageSeed([
      { party_id: 'SSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_code: null, is_successor: false, note: "Uddhav's faction", source_url: 'https://x' },
      { party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: '2020-02-17', state_code: 'KL', is_successor: true, note: null, source_url: null },
    ], parties, states);
    expect(sql).toContain("INSERT INTO party_lineage (party_id, predecessor_id, kind, effective_date, state_id, is_successor, note, source_url) VALUES ('SSUBT', 'SHS', 'split', '2022-10-10', NULL, false, 'Uddhav''s faction', 'https://x') ON CONFLICT DO NOTHING;");
    expect(sql).toContain("VALUES ('BJP', 'JVM', 'merger', '2020-02-17', 16, true, NULL, NULL) ON CONFLICT DO NOTHING;");
  });
  it('refuses an unknown party id, an unknown state code or a bad kind', () => {
    const r = { party_id: 'XX', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_code: null, is_successor: false, note: null, source_url: null };
    expect(() => emitLineageSeed([r], parties, states)).toThrow(/unknown party XX/);
    expect(() => emitLineageSeed([{ ...r, party_id: 'SSUBT', state_code: 'ZZ' }], parties, states)).toThrow(/unknown state ZZ/);
    expect(() => emitLineageSeed([{ ...r, party_id: 'SSUBT', kind: 'fork' }], parties, states)).toThrow(/bad kind fork/);
    expect(emitLineageSeed([{ ...r, party_id: 'SSUBT', kind: 'breakaway' }], parties, states)).toContain("'breakaway'");
  });
});

describe('pickCandidate', () => {
  const cands = [
    { id: 'c1', name: 'Samrat Choudhary', year: 2025 }, { id: 'c0', name: 'Samrat Choudhary', year: 2020 },
    { id: 'c2', name: 'Tejashwi Prasad Yadav', year: 2025 }, { id: 'c3', name: 'Tej Pratap Yadav', year: 2025 },
  ];
  it('the newest candidacy whose name holds every word of the person\'s name', () => {
    expect(pickCandidate(cands, 'Samrat Choudhary')).toBe('c1');
    expect(pickCandidate(cands, 'Tejashwi Yadav')).toBe('c2');
  });
  it('null when no candidate matches or two different people match', () => {
    expect(pickCandidate(cands, 'Dilip Jaiswal')).toBeNull();
    expect(pickCandidate(cands, 'Yadav')).toBeNull();
  });
});

describe('emitUnitsSeed', () => {
  const units = [{ party_id: 'BJP', state_code: 'BR', eci_recognition: 'National', office: 'Patna', website: null,
    roles: [{ role: 'state_president', person_name: 'Dilip Jaiswal', from_date: '2024-07-25', to_date: null, source_url: 'https://y' },
            { role: 'legislature_leader', person_name: 'Samrat Choudhary', from_date: null, to_date: null, source_url: 'https://z' }] }];
  const sql = emitUnitsSeed(units, parties, states, (name) => (name === 'Samrat Choudhary' ? 'c1' : null));
  it('is a run-once seed', () => {
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_party_units_v1')");
  });
  it('inserts the unit and its roles, linking a person through the candidate (stable id) when one matches', () => {
    expect(sql).toContain("INSERT INTO party_units (party_id, state_id, eci_recognition, office, website) VALUES ('BJP', 5, 'National', 'Patna', NULL) ON CONFLICT DO NOTHING;");
    expect(sql).toContain("VALUES ('BJP', 5, 'state_president', NULL, 'Dilip Jaiswal', '2024-07-25', NULL, 'https://y') ON CONFLICT DO NOTHING;");
    expect(sql).toContain("VALUES ('BJP', 5, 'legislature_leader', (SELECT person_id FROM candidates WHERE id = 'c1'), 'Samrat Choudhary', NULL, NULL, 'https://z') ON CONFLICT DO NOTHING;");
  });
  it('refuses a bad role or recognition', () => {
    expect(() => emitUnitsSeed([{ ...units[0], eci_recognition: 'Big' }], parties, states, () => null)).toThrow(/bad recognition Big/);
    expect(() => emitUnitsSeed([{ ...units[0], roles: [{ ...units[0].roles[0], role: 'boss' }] }], parties, states, () => null)).toThrow(/bad role boss/);
    expect(() => emitUnitsSeed([{ ...units[0], roles: [{ ...units[0].roles[0], person_name: null as never }] }], parties, states, () => null)).toThrow(/BJP BR state_president has no person_name/);
  });
});
