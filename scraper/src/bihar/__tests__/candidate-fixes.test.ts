import { describe, expect, it } from 'vitest';
import { applyCandidateFixes, duplicatePartySeats } from '../candidate-fixes';
import type { ElectionJson } from '../types';

const json = () => ({ year: 2012, seats: [{ constNo: 72, candidates: [
  { serial: 17, name: 'Suman Kumari', partyId: 'ASP_UP', votes: 350 }, { serial: 21, name: 'Yadram', partyId: 'ASP_UP', votes: 171 },
  { serial: 30, name: 'A', partyId: 'IND', votes: 5 }, { serial: 31, name: 'B', partyId: 'IND', votes: 4 }] }] }) as unknown as ElectionJson;

describe('candidate fixes', () => {
  it('finds seats where one party (not IND) has two candidates', () => {
    expect(duplicatePartySeats(json())).toEqual(['72: ASP_UP']);
  });
  it('applies a sourced party fix to one candidate', () => {
    const fixed = applyCandidateFixes(json(), { '72:21': { partyId: 'IND', reason: 'r' } });
    expect(fixed.seats[0].candidates[1].partyId).toBe('IND');
    expect(duplicatePartySeats(fixed)).toEqual([]);
  });
  it('fails on a fix for a candidate that does not exist', () => {
    expect(() => applyCandidateFixes(json(), { '72:99': { partyId: 'IND', reason: 'r' } })).toThrow(/72:99/);
  });
});
