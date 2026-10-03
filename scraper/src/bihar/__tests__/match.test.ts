// scraper/src/bihar/__tests__/match.test.ts
import { describe, it, expect } from 'vitest';
import { matchYear, stableUuid } from '../match';
import type { ExistingSeed } from '../existing-seed';
import type { ElectionJson } from '../types';

const seed = (): ExistingSeed => ({
  electionSql: '', manifestJson: null,
  constituencies: [{ id: 'BR_VS10_1_X', constNo: 1, name: 'X' }],
  candidates: [
    { id: 'old-jdu', constId: 'BR_VS10_1_X', partyId: 'JDU', name: 'Rajesh Singh', resultId: 'r1' },
    { id: 'old-ind', constId: 'BR_VS10_1_X', partyId: 'IND', name: 'Deep Narayan Mahato', resultId: 'r2' },
    { id: 'old-rjd', constId: 'BR_VS10_1_X', partyId: 'RJD', name: 'Somebody Else', resultId: 'r3' },
  ],
});
const json = (): ElectionJson => ({ year: 2010, electionId: 'e', source: { title: '', url: '', retrieved: '' }, parties: [], seats: [{
  constNo: 1, type: 'GEN', electors: 1, voters: 1, turnout: 1, phase: 1, pollDate: '2010-10-21', candidates: [
    { serial: 1, name: 'Rajesh Singh', partyId: 'JDU', sex: 'M', age: 37, votes: 42289, status: 'WON' },
    { serial: 2, name: 'Mukesh Kumar Kushwaha', partyId: 'RJD', sex: 'M', age: 34, votes: 27618, status: 'LOST' },
    { serial: 5, name: 'Deep Narayan Mahato', partyId: 'IND', sex: 'M', age: 65, votes: 14047, status: 'LOST' },
    { serial: 7, name: 'Saket Kumar Pathak', partyId: 'IND', sex: 'M', age: 27, votes: 4428, status: 'LOST' },
  ] }] });

describe('matchYear', () => {
  it('matches by party when unique, IND only by name, and records similarity', () => {
    const [s] = matchYear(json(), seed(), {});
    expect(s.matched.map(m => [m.old.id, m.serial])).toEqual([['old-jdu', 1], ['old-ind', 5], ['old-rjd', 2]]);
    expect(s.matched.find(m => m.old.id === 'old-rjd')!.similarity).toBeLessThan(0.5); // flagged for review
    expect(s.unmatchedOld).toEqual([]);
  });
  it('leaves an IND row without a name match unmatched, and applies decisions', () => {
    const sd = seed(); sd.candidates[1].name = 'Unknown Person';
    expect(matchYear(json(), sd, {})[0].unmatchedOld.map(o => o.id)).toEqual(['old-ind']);
    const del = matchYear(json(), sd, { 'old-ind': { action: 'delete', reason: 'not in ECI' } })[0];
    expect(del.unmatchedOld).toEqual([]); expect(del.deleted.map(o => o.id)).toEqual(['old-ind']);
    const mt = matchYear(json(), sd, { 'old-ind': { action: 'match', serial: 7, reason: 'same person, misspelt' } })[0];
    expect(mt.matched.find(m => m.old.id === 'old-ind')!.serial).toBe(7);
  });
  it('treats an aliased old party id as the new one (duplicate DB ids)', () => {
    const sd = seed(); sd.candidates[0].partyId = 'JDU_OLD';
    const [s] = matchYear(json(), sd, {}, { JDU_OLD: 'JDU' });
    expect(s.matched.find(m => m.old.id === 'old-jdu')!.serial).toBe(1);
  });
  it('fails on a decision that points at a missing serial', () => {
    expect(() => matchYear(json(), seed(), { 'old-ind': { action: 'match', serial: 99, reason: 'x' } })).toThrow(/serial 99/);
  });
});

describe('stableUuid', () => {
  it('is deterministic and UUID-shaped', () => {
    expect(stableUuid('bihar', 2010, 1, 7)).toBe(stableUuid('bihar', 2010, 1, 7));
    expect(stableUuid('bihar', 2010, 1, 7)).not.toBe(stableUuid('bihar', 2010, 1, 8));
    expect(stableUuid('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
