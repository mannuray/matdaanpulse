import { describe, it, expect } from 'vitest';
import { partyContext } from '../partyContext';
import type { LineageEvent, PartyUnit } from '../../types';

const ev = (party_id: string, predecessor_id: string, kind: LineageEvent['kind'], effective_date: string, is_successor = kind !== 'split' && kind !== 'breakaway', state_id: number | null = null): LineageEvent =>
  ({ party_id, predecessor_id, kind, effective_date, state_id, is_successor, note: null });
const events = [ev('SSUBT', 'SHS', 'split', '2022-10-10'), ev('BJP', 'JVM', 'merger', '2020-02-17'), ev('JJP2', 'INLD', 'breakaway', '2018-12-09'), ev('KEC', 'KECM', 'split', '2020-08-30', false, 16)];
const units: PartyUnit[] = [{ state_id: 5, state_name: 'Bihar', eci_recognition: 'National', office: 'Patna', website: null, roles: [
  { role: 'state_president', person_id: 'p1', person_name: 'Sanjay Saraogi', from_date: '2025-12-15', to_date: null },
  { role: 'state_president', person_id: null, person_name: 'Dilip Jaiswal', from_date: null, to_date: '2025-12-15' },
  { role: 'legislature_leader', person_id: null, person_name: 'Samrat Choudhary', from_date: null, to_date: null }] }];

describe('partyContext', () => {
  it('the state unit: recognition there and the current president and legislature leader', () => {
    const c = partyContext({ partyId: 'BJP', units, events, stateId: 5, date: '2025-11-14', seats: new Map() });
    expect(c.unit).toEqual({ stateName: 'Bihar', recognition: 'National', president: { name: 'Sanjay Saraogi', personId: 'p1' }, legislatureLeader: { name: 'Samrat Choudhary', personId: null } });
    expect(partyContext({ partyId: 'BJP', units, events, stateId: 9, date: '2022-03-10', seats: new Map() }).unit).toBeNull();
    expect(partyContext({ partyId: 'BJP', units, events, stateId: null, date: '2024-06-04', seats: new Map() }).unit).toBeNull();
  });
  it('lineage notes from this party\'s side, state-scoped events only in their state', () => {
    expect(partyContext({ partyId: 'SSUBT', units: [], events, stateId: 20, date: '2024-11-23', seats: new Map() }).notes).toEqual([{ kind: 'factionOf', other: 'SHS', year: 2022 }]);
    expect(partyContext({ partyId: 'BJP', units: [], events, stateId: 14, date: '2024-11-23', seats: new Map() }).notes).toEqual([{ kind: 'absorbed', other: 'JVM', year: 2020 }]);
    expect(partyContext({ partyId: 'JVM', units: [], events, stateId: 14, date: '2014-12-23', seats: new Map() }).notes).toEqual([{ kind: 'mergedInto', other: 'BJP', year: 2020 }]);
    expect(partyContext({ partyId: 'JJP2', units: [], events, stateId: 11, date: '2019-10-24', seats: new Map() }).notes).toEqual([{ kind: 'brokeAwayFrom', other: 'INLD', year: 2018 }]);
    expect(partyContext({ partyId: 'KEC', units: [], events, stateId: 31, date: '2021-05-02', seats: new Map() }).notes).toEqual([]);
  });
  it('the family total for this election after a split', () => {
    const c = partyContext({ partyId: 'SSUBT', units: [], events, stateId: 20, date: '2024-11-23', seats: new Map([['SHS', 57], ['SSUBT', 20]]) });
    expect(c.family).toEqual({ root: 'SHS', members: [{ id: 'SHS', seats: 57 }, { id: 'SSUBT', seats: 20 }], total: 77 });
    expect(partyContext({ partyId: 'BJP', units: [], events, stateId: 5, date: '2025-11-14', seats: new Map() }).family).toBeNull();
  });
});

describe('partyContext relevance', () => {
  it('a note about another party appears only when that party is relevant in this state', () => {
    const evs = [ev('BJP', 'JVM', 'merger', '2020-02-17'), ev('BJP', 'KJPS', 'merger', '2024-01-31')];
    expect(partyContext({ partyId: 'BJP', units: [], events: evs, stateId: 14, date: '2024-11-23', seats: new Map(), relevant: p => p !== 'KJPS' }).notes)
      .toEqual([{ kind: 'absorbed', other: 'JVM', year: 2020 }]);
  });
});
