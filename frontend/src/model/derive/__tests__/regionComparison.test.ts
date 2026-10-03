import { describe, expect, it } from 'vitest';
import { compareRegions } from '../regionComparison';

const prev = { regions: [{ id: 1, name: 'Upper Assam', seats: 2, parties: [{ party_id: 'BJP', votes: 60, won: 1 }, { party_id: 'INC', votes: 40, won: 1 }] }] };
const cur = { regions: [{ id: 1, name: 'Upper Assam', seats: 3, parties: [{ party_id: 'BJP', votes: 70, won: 3 }, { party_id: 'BOPF', votes: 10, won: 0 }, { party_id: 'INC', votes: 20, won: 0 }] }] };
const nda26 = [{ id: 'NDA', name: 'NDA', color: '#f80', parties: ['BJP', 'BOPF'] }, { id: 'ASM', name: 'Congress+', color: '#19a', parties: ['INC'] }];
const nda21 = [{ id: 'NDA', name: 'NDA', color: '#f80', parties: ['BJP'] }, { id: 'MGB', name: 'Mahajot', color: '#19a', parties: ['INC', 'BOPF'] }];

describe('compareRegions', () => {
  it('compares each year\'s own alliances, matched by id, with a statewide row first', () => {
    const rows = compareRegions(cur, prev, nda26, nda21);
    expect(rows.map(r => r.name)).toEqual(['Statewide', 'Upper Assam']);
    expect(rows[1].groups.find(g => g.id === 'NDA')).toMatchObject({ share: [60, 80], won: [1, 3] });
    expect(rows[1].groups.find(g => g.id === 'ASM')).toMatchObject({ share: [null, 20] });
    expect(rows[1].groups.find(g => g.id === 'MGB')).toMatchObject({ share: [40, null] });
    expect(rows[1].seats).toEqual([2, 3]);
  });
  it('puts parties in no alliance under Others', () => {
    const rows = compareRegions(cur, prev, [], []);
    expect(rows[0].groups).toEqual([{ id: 'OTHERS', label: 'Others', color: 'var(--color-fallback)', share: [100, 100], won: [2, 3] }]);
  });
  it('shows a region new in this election with no previous figures', () => {
    const rows = compareRegions({ regions: [...cur.regions, { id: 2, name: 'Hills', seats: 1, parties: [{ party_id: 'BJP', votes: 5, won: 1 }] }] }, prev, nda26, nda21);
    expect(rows[2]).toMatchObject({ name: 'Hills', seats: [0, 1] });
    expect(rows[2].groups.find(g => g.id === 'NDA')).toMatchObject({ share: [null, 100] });
  });
});
