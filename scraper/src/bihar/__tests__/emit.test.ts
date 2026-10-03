// scraper/src/bihar/__tests__/emit.test.ts
import { describe, it, expect } from 'vitest';
import { changedRows, emitCorrections, emitParties, emitYear, seatMargin, candidateIds, type Plan } from '../emit';
import type { ElectionJson } from '../types';

const json: ElectionJson = { year: 2010, electionId: 'a1b2c3d4-e5f6-7890-abcd-111111111010', source: { title: 'ECI Statistical Report, Bihar 2010', url: 'https://eci', retrieved: '2026-10-03' },
  parties: [{ id: 'JDU', name: 'Janata Dal (United)', abbreviation: 'JD(U)', color: '#003366', recognition: 'State' }],
  seats: [{ constNo: 1, type: 'SC', electors: 240418, voters: 143701, turnout: 59.77, phase: 2, pollDate: '2010-10-28', candidates: [
    { serial: 1, name: 'Rajesh Singh', partyId: 'JDU', sex: 'M', age: 37, votes: 42289, status: 'WON' },
    { serial: 2, name: "Mukesh O'Kushwaha", partyId: 'RJD', sex: 'M', age: 34, votes: 27618, status: 'LOST' },
    { serial: 3, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: 500, status: 'LOST' },
  ] }] };
const plan = (): Plan => ({
  json,
  seed: { electionSql: "INSERT INTO elections (id) VALUES\n  ('a1b2c3d4-e5f6-7890-abcd-111111111010')\nON CONFLICT (id) DO NOTHING;", manifestJson: '{"a":"it\'s"}',
    constituencies: [{ id: 'BR_VS10_1_VALMIKI_NAGAR', constNo: 1, name: 'Valmiki Nagar' }],
    candidates: [
      { id: '11111111-1111-1111-1111-111111111111', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'JDU', name: 'Rajesh Singh', resultId: '22222222-2222-2222-2222-222222222222' },
      { id: '33333333-3333-3333-3333-333333333333', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'LJP', name: 'Gone Person', resultId: '44444444-4444-4444-4444-444444444444' },
    ] },
  matches: [{ constId: 'BR_VS10_1_VALMIKI_NAGAR', matched: [{ old: { id: '11111111-1111-1111-1111-111111111111', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'JDU', name: 'Rajesh Singh', resultId: '22222222-2222-2222-2222-222222222222' }, serial: 1, similarity: 1, partyChanged: false }],
    unmatchedOld: [], deleted: [{ id: '33333333-3333-3333-3333-333333333333', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'LJP', name: 'Gone Person', resultId: '44444444-4444-4444-4444-444444444444' }] }],
});

describe('emit', () => {
  it('computes the seat margin without NOTA', () => { expect(seatMargin(json.seats[0])).toBe(14671); });
  it('reuses old ids for matched candidates and stable ids for new ones', () => {
    const ids = candidateIds(plan());
    expect(ids.get('1:1')).toEqual({ candidateId: '11111111-1111-1111-1111-111111111111', resultId: '22222222-2222-2222-2222-222222222222' });
    expect(ids.get('1:2')!.candidateId).toMatch(/^[0-9a-f-]{36}$/);
    expect(candidateIds(plan()).get('1:2')).toEqual(ids.get('1:2'));
  });
  it('emits parties as fill-only inserts', () => {
    expect(emitParties(json.parties)).toContain("INSERT INTO parties (id, name, abbreviation, color, eci_recognition) VALUES\n  ('JDU', 'Janata Dal (United)', 'JD(U)', '#003366', 'State')\nON CONFLICT (id) DO NOTHING;");
  });
  it('emits the year seed: kept election statement, constituency facts, candidates, results with the seat margin, gender fill, guarded manifest', () => {
    const sql = emitYear(plan());
    expect(sql).toContain("('a1b2c3d4-e5f6-7890-abcd-111111111010')\nON CONFLICT (id) DO NOTHING;");
    expect(sql).toContain("('BR_VS10_1_VALMIKI_NAGAR', 'a1b2c3d4-e5f6-7890-abcd-111111111010', NULL, 5, 'Valmiki Nagar', 1, 'SC', 59.77, 2, 240418)");
    expect(sql).toContain("('11111111-1111-1111-1111-111111111111', NULL, 'a1b2c3d4-e5f6-7890-abcd-111111111010', 'BR_VS10_1_VALMIKI_NAGAR', 'JDU', 'Rajesh Singh', FALSE, 37)");
    expect(sql).toContain("'Mukesh O''Kushwaha'");
    expect(sql).toContain("('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'BR_VS10_1_VALMIKI_NAGAR', 42289, 'WON', 14671, 0, 'a1b2c3d4-e5f6-7890-abcd-111111111010')");
    expect(sql).toMatch(/'NOTA', 'NOTA', FALSE, NULL\)/);
    expect(sql).toContain('AND p.gender IS NULL');
    expect(sql).toContain("UPDATE elections SET manifest_url = '{\"a\":\"it''s\"}' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-111111111010' AND manifest_url IS NULL;");
    expect(sql).not.toContain('33333333-3333-3333-3333-333333333333');
    expect(sql).not.toMatch(/metadata/);
  });
  it('wraps the year seed in one transaction so a failure leaves nothing half-applied', () => {
    const sql = emitYear(plan());
    expect(sql.trimStart().split('\n').find(l => !l.startsWith('--') && l.trim())).toBe('BEGIN;');
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });
  it('starts the corrections body with a pre-flight that stops on production rows the seeds do not know', () => {
    const sql = emitCorrections([plan()]);
    const body = sql.slice(sql.indexOf('\\if :seed_apply'));
    expect(body.indexOf('RAISE EXCEPTION')).toBeGreaterThan(0);
    expect(body.indexOf('RAISE EXCEPTION')).toBeLessThan(body.indexOf('DELETE FROM results'));
    expect(sql).toContain("('11111111-1111-1111-1111-111111111111', 'JDU')");
    expect(sql).toContain("('33333333-3333-3333-3333-333333333333', 'LJP')");
    expect(sql).toContain("c.election_id IN ('a1b2c3d4-e5f6-7890-abcd-111111111010')");
  });
  it('emits a run-once corrections seed: deletes, result/candidate/constituency updates, guarded person rename', () => {
    const sql = emitCorrections([plan()]);
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_corrections_v1')");
    expect(sql).toContain("EXISTS (SELECT 1 FROM constituencies WHERE election_id = 'a1b2c3d4-e5f6-7890-abcd-111111111010')");
    expect(sql).toContain("DELETE FROM results WHERE candidate_id IN ('33333333-3333-3333-3333-333333333333');");
    expect(sql).toContain("DELETE FROM candidates WHERE id IN ('33333333-3333-3333-3333-333333333333');");
    expect(sql).toContain("('22222222-2222-2222-2222-222222222222', 42289, 'WON', 14671)");
    expect(sql).toContain("('11111111-1111-1111-1111-111111111111', 'Rajesh Singh', 'JDU', 37, 'Rajesh Singh')");
    expect(sql).toContain('(SELECT count(*) FROM candidates c2 WHERE c2.person_id = p.id) = 1');
    expect(sql).toContain("('BR_VS10_1_VALMIKI_NAGAR', 'SC', 240418, 59.77, 2)");
    expect(sql.indexOf('DELETE FROM results')).toBeLessThan(sql.indexOf('UPDATE results'));
  });
});

describe('changedRows', () => {
  it('lists ids present in both seeds whose row changed, ignoring new and removed rows', () => {
    const before = emitYear(plan());
    const p = plan(); p.json = JSON.parse(JSON.stringify(json)); p.json.seats[0].candidates[0].votes = 42290;
    p.json.seats[0].candidates.push({ serial: 9, name: 'New Person', partyId: 'IND', sex: 'M', age: 30, votes: 1, status: 'LOST' });
    const after = emitYear(p);
    expect(changedRows(before, before)).toEqual([]);
    const changed = changedRows(before, after);
    // the winner's result (votes) and the seat's other two result rows (margin 14672); the new candidate is not listed
    expect(changed).toHaveLength(3);
    expect(changed).toContain('22222222-2222-2222-2222-222222222222');
  });
  it('detects a changed candidate name (not masked by the gender-fill rows keyed by the same id)', () => {
    const p = plan(); p.json = JSON.parse(JSON.stringify(json)); p.json.seats[0].candidates[0].name = 'Rajesh Kumar Singh';
    expect(changedRows(emitYear(plan()), emitYear(p))).toEqual(['11111111-1111-1111-1111-111111111111']);
  });
});
