import { describe, it, expect } from 'vitest';
import { electionChoices } from '../electionChoices';

const e = (id: string, state_id: number, year: number, status: 'Finalized' | 'Live' | 'Upcoming' = 'Finalized', type: 'VS' | 'LS' = 'VS') => ({ id, state_id, year, status, type });
const states = [{ id: 5, name: 'Bihar' }, { id: 9, name: 'Goa' }, { id: 4, name: 'Assam' }, { id: 24, name: 'Delhi' }];
const all = [e('br20', 5, 2020), e('br25', 5, 2025), e('ga22', 9, 2022), e('ga27', 9, 2027, 'Upcoming'), e('as26', 4, 2026), e('dl25', 24, 2025), e('ls24', 0, 2024, 'Finalized', 'LS')];

describe('electionChoices', () => {
  it('one row per state, alphabetical, newest year first; Vidhan Sabha only', () => {
    const c = electionChoices(all, states, '');
    expect(c.rows.map(r => [r.name, r.elections.map(x => x.year)])).toEqual([['Assam', [2026]], ['Bihar', [2025, 2020]], ['Delhi', [2025]], ['Goa', [2027, 2022]]]);
  });
  it('pins live and upcoming elections', () => {
    expect(electionChoices(all, states, '').pinned.map(x => [x.id, x.stateName, x.year, x.status])).toEqual([['ga27', 'Goa', 2027, 'Upcoming']]);
  });
  it('filters by state name and year: "bih", "2025", "bih 20"', () => {
    expect(electionChoices(all, states, 'bih').rows.map(r => r.name)).toEqual(['Bihar']);
    expect(electionChoices(all, states, '2025').rows.map(r => [r.name, r.elections.map(x => x.year)])).toEqual([['Bihar', [2025]], ['Delhi', [2025]]]);
    expect(electionChoices(all, states, 'bih 202').rows.map(r => r.elections.map(x => x.year))).toEqual([[2025, 2020]]);
    expect(electionChoices(all, states, 'kerala').rows).toEqual([]);
  });
});
