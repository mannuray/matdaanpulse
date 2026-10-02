import { describe, it, expect } from 'vitest';
import type { Election } from '../../types';
import { electionGroup, groupElections, matchesElection, pinnedElections } from './electionGrid';

const el = (id: string, name: string, type: 'LS' | 'VS', year: number, status: Election['status'] = 'Finalized'): Election =>
  ({ id, name, type, year, status, state_id: null, tentative_next_date: null, manifest_url: null });

const all = [
  el('wb21', 'West Bengal Vidhan Sabha 2021', 'VS', 2021),
  el('br20', 'Bihar Vidhan Sabha 2020', 'VS', 2020),
  el('ls29', 'Lok Sabha General Election 2029', 'LS', 2029, 'Upcoming'),
  el('br25', 'Bihar Vidhan Sabha 2025', 'VS', 2025, 'Live'),
  el('ls24', 'Lok Sabha General Election 2024', 'LS', 2024),
  el('tn21', 'Tamil Nadu Vidhan Sabha 2021', 'VS', 2021),
];

describe('electionGrid', () => {
  it('labels rows by state, or Lok Sabha', () => {
    expect(electionGroup(all[0])).toBe('West Bengal');
    expect(electionGroup(all[2])).toBe('Lok Sabha');
  });

  it('puts Lok Sabha first, states A–Z, years newest first', () => {
    const rows = groupElections(all);
    expect(rows.map((r) => r.label)).toEqual(['Lok Sabha', 'Bihar', 'Tamil Nadu', 'West Bengal']);
    expect(rows[1].elections.map((e) => e.year)).toEqual([2025, 2020]);
  });

  it('pins live before upcoming and leaves finalized out', () => {
    expect(pinnedElections(all).map((e) => e.id)).toEqual(['br25', 'ls29']);
  });

  it.each([
    ['bih 20', ['br20', 'br25']],
    ['bihar 2025', ['br25']],
    ['wb', ['wb21']],
    ['tn', ['tn21']],
    ['beng', ['wb21']],
    ['ls', ['ls29', 'ls24']],
    ['vidhan 2021', ['wb21', 'tn21']],
    ['live', ['br25']],
    ['', all.map((e) => e.id)],
    ['kerala', []],
  ])('search %j', (q, ids) => {
    expect(all.filter((e) => matchesElection(e, q)).map((e) => e.id).sort()).toEqual([...ids].sort());
  });
});
