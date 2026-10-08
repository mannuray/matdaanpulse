import { describe, it, expect } from 'vitest';
import { previousComparable, deltaOf, latestByState, headline, sparkline, recordLines, partyPageHref } from '../partyRecord';
import type { PartyRecord, PartyRecordElection, LineageEvent } from '../../types';

const e = (id: string, state_id: number, year: number, won: number, over: Partial<PartyRecordElection> = {}): PartyRecordElection => ({
  election_id: id, state_id, state_code: state_id === 9 ? 'JH' : 'GA', state_name: state_id === 9 ? 'Jharkhand' : 'Goa', year, date: `${year}-12-01`,
  delimitation: '2008', contested: 60, won, votes: 1, share: 30, held: 0, gained: 0, lost: 0, split_gained: 0, split_lost: 0,
  seats_total: 81, largest: false, formed_government: null, family: [], ...over });
const merger: LineageEvent = { party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: '2020-02-17', state_id: 9, is_successor: true, note: null };
const rec = (elections: PartyRecordElection[], lineage: LineageEvent[] = []): PartyRecord => ({ party_id: 'BJP', elections, lineage });
const nameOf = (id: string) => (id === 'JVM' ? 'JVM(P)' : id);

describe('partyRecord', () => {
  it('previous comparable: same state and delimitation only', () => {
    const rows = [e('a', 9, 2024, 21), e('b', 9, 2019, 25), e('g', 3, 2022, 20), e('c', 9, 2005, 30, { delimitation: '1976' })];
    expect(previousComparable(rows, rows[0])?.election_id).toBe('b');
    expect(previousComparable(rows, rows[1])).toBeNull();
  });
  it('delta adds merged predecessors to the earlier total and names them', () => {
    const rows = [e('a', 9, 2024, 21, { share: 33.2 }), e('b', 9, 2019, 25, { share: 33.4, family: [{ party_id: 'JVM', won: 3, share: 5.5 }] })];
    const d = deltaOf('BJP', rows, rows[0], [merger], nameOf)!;
    expect(d.seats).toBe(-7);
    expect(d.share).toBeCloseTo(-5.7, 6);
    expect(d.vsLabel).toBe('BJP + JVM(P) 2019');
  });
  it('delta without a family row uses only the party’s own total', () => {
    const rows = [e('a', 9, 2024, 21), e('b', 9, 2019, 25)];
    expect(deltaOf('BJP', rows, rows[0], [merger], nameOf)).toEqual({ seats: -4, share: 0, vsLabel: null });
  });
  it('a family member that did not merge into the party is not added', () => {
    const rows = [e('a', 9, 2024, 21), e('b', 9, 2019, 25, { family: [{ party_id: 'JVM', won: 3, share: 5 }] })];
    expect(deltaOf('BJP', rows, rows[0], [], nameOf)).toEqual({ seats: -4, share: 0, vsLabel: null });
  });
  it('across a redraw: seats null, vote share continues; no earlier election: null', () => {
    const rows = [e('a', 9, 2024, 21, { delimitation: '2023', share: 35 }), e('b', 9, 2019, 25, { share: 30 })];
    expect(deltaOf('BJP', rows, rows[0], [], nameOf)).toEqual({ seats: null, share: 5, vsLabel: null });
    expect(deltaOf('BJP', rows, rows[1], [], nameOf)).toBeNull();
  });
  it('latest per state sorted by won; headline sums', () => {
    const r = rec([e('a', 9, 2024, 21, { formed_government: false }), e('b', 9, 2019, 25), e('g', 3, 2022, 20, { seats_total: 40, formed_government: true, largest: true })]);
    expect(latestByState(r).map(x => x.election_id)).toEqual(['a', 'g']);
    expect(headline(r)).toEqual({ won: 41, seats: 121, statesWon: 2, statesContested: 2, governs: 1, largest: 1 });
  });
  it('governs is null when no latest election has a government record', () => {
    expect(headline(rec([e('a', 9, 2024, 21)])).governs).toBeNull();
  });
  it('sparkline oldest → newest; record lines put events and redraws in place', () => {
    const r = rec([e('a', 9, 2024, 21), e('b', 9, 2019, 25), e('c', 9, 2005, 30, { delimitation: '1976' })], [merger]);
    expect(sparkline(r, 9)).toEqual([30, 25, 21]);
    expect(recordLines('BJP', r, 9, nameOf).map(l => l.kind)).toEqual(['election', 'event', 'election', 'redraw', 'election']);
  });
  it('a national event shows inline only where the predecessor ran (a Kerala merger stays out of Jharkhand)', () => {
    const kjps: LineageEvent = { party_id: 'BJP', predecessor_id: 'KJPS', kind: 'merger', effective_date: '2024-03-01', state_id: null, is_successor: true, note: null };
    const jvmNational: LineageEvent = { ...merger, state_id: null };
    const r = rec([e('a', 9, 2024, 21), e('b', 9, 2019, 25, { family: [{ party_id: 'JVM', won: 3, share: 5 }] })], [jvmNational, kjps]);
    const events = recordLines('BJP', r, 9, nameOf).filter(l => l.kind === 'event').map(l => (l.kind === 'event' ? l.event.predecessor_id : ''));
    expect(events).toEqual(['JVM']);
  });
  it('a party with no elections: empty everything, no crash', () => {
    const r = rec([]);
    expect(latestByState(r)).toEqual([]);
    expect(headline(r)).toEqual({ won: 0, seats: 0, statesWon: 0, statesContested: 0, governs: null, largest: 0 });
    expect(recordLines('BJP', r, 9, nameOf)).toEqual([]);
  });
  it('party page links: /party/:id (optionally ?state=), none for independents, NOTA or a blank id', () => {
    expect(partyPageHref('BJP')).toBe('/party/BJP');
    expect(partyPageHref('BJP', 'br')).toBe('/party/BJP?state=BR');
    expect(partyPageHref('IND')).toBeNull();
    expect(partyPageHref('NOTA')).toBeNull();
    expect(partyPageHref('')).toBeNull();
  });
});
