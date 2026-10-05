import { describe, expect, it } from 'vitest';
import { compareRegions } from '../regionComparison';

const prev = { regions: [{ id: 1, name: 'Upper Assam', seats: 2, const_ids: ['P1', 'P2'], parties: [{ party_id: 'BJP', votes: 60, won: 1 }, { party_id: 'INC', votes: 40, won: 1 }] }] };
const cur = { regions: [{ id: 1, name: 'Upper Assam', seats: 3, const_ids: ['A1', 'A2', 'A3'], parties: [{ party_id: 'BJP', votes: 70, won: 3 }, { party_id: 'BOPF', votes: 10, won: 0 }, { party_id: 'INC', votes: 20, won: 0 }] }] };
const nda26 = [{ id: 'NDA', name: 'NDA', color: '#f80', parties: ['BJP', 'BOPF'] }, { id: 'ASM', name: 'Congress+', color: '#19a', parties: ['INC'] }];
const L = { statewide: 'Statewide', others: 'Others' };
const nda21 = [{ id: 'NDA', name: 'NDA', color: '#f80', parties: ['BJP'] }, { id: 'MGB', name: 'Mahajot', color: '#19a', parties: ['INC', 'BOPF'] }];

describe('compareRegions', () => {
  it('compares each year\'s own alliances, matched by id, with a statewide row first', () => {
    const rows = compareRegions(cur, prev, { mode: 'alliance', curAlliances: nda26, prevAlliances: nda21, labels: L });
    expect(rows.map(r => r.name)).toEqual(['Statewide', 'Upper Assam']);
    expect(rows[1].groups.find(g => g.id === 'NDA')).toMatchObject({ share: [60, 80], won: [1, 3] });
    expect(rows[1].groups.find(g => g.id === 'ASM')).toMatchObject({ share: [null, 20] });
    expect(rows[1].groups.find(g => g.id === 'MGB')).toMatchObject({ share: [40, null] });
    expect(rows[1].seats).toEqual([2, 3]);
  });
  it('puts parties in no alliance under Others', () => {
    const rows = compareRegions(cur, prev, { mode: 'alliance', curAlliances: [], prevAlliances: [], labels: L });
    expect(rows[0].groups).toEqual([{ id: 'OTHERS', label: 'Others', color: 'var(--color-fallback)', share: [100, 100], won: [2, 3] }]);
  });
  it('shows a region new in this election with no previous figures', () => {
    const rows = compareRegions({ regions: [...cur.regions, { id: 2, name: 'Hills', seats: 1, const_ids: ['A4'], parties: [{ party_id: 'BJP', votes: 5, won: 1 }] }] }, prev, { mode: 'alliance', curAlliances: nda26, prevAlliances: nda21, labels: L });
    expect(rows[2]).toMatchObject({ name: 'Hills', seats: [0, 1] });
    expect(rows[2].groups.find(g => g.id === 'NDA')).toMatchObject({ share: [null, 100] });
  });
});

describe('compareRegions by party (the default view)', () => {
  const meta = new Map([['BJP', { label: 'BJP', color: '#f80' }], ['INC', { label: 'INC', color: '#19a' }], ['BOPF', { label: 'BPF', color: '#2e7' }]]);
  it('shows the top parties by current statewide vote, the rest as Others', () => {
    const rows = compareRegions(cur, prev, { mode: 'party', partyMeta: meta, topParties: 2, labels: { statewide: 'राज्य', others: 'अन्य' } });
    expect(rows[0].name).toBe('राज्य');
    expect(rows[1].groups.map(g => g.id)).toEqual(['BJP', 'INC', 'OTHERS']);
    expect(rows[1].groups[0]).toMatchObject({ label: 'BJP', share: [60, 70], won: [1, 3] });
    expect(rows[1].groups[2]).toMatchObject({ label: 'अन्य', share: [null, 10] });
  });
  it('has no previous figures when there is no earlier election', () => {
    const rows = compareRegions(cur, null, { mode: 'party', partyMeta: meta, topParties: 2, labels: L });
    expect(rows[1].seats).toEqual([null, 3]);
    expect(rows[1].groups[0]).toMatchObject({ share: [null, 70], won: [null, 3] });
  });
});

describe('compareRegions seat ids (the map highlight)', () => {
  it('gives each region its current seats, and Statewide every seat', () => {
    const rows = compareRegions({ regions: [...cur.regions, { id: 2, name: 'Hills', seats: 1, const_ids: ['A4'], parties: [] }] }, prev, { mode: 'party', partyMeta: new Map(), labels: L });
    expect(rows.map(r => r.seatIds)).toEqual([['A1', 'A2', 'A3', 'A4'], ['A1', 'A2', 'A3'], ['A4']]);
  });
});
