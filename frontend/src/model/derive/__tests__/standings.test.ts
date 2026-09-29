import { describe, it, expect } from 'vitest';
import { deriveStandingRows, compactList } from '../standings';

const parties = [
  { id: 'RJD', name: 'Rashtriya Janata Dal', color: '#7BD34A', seats: 25 },
  { id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 89 },
  { id: 'JSP', name: 'Jan Suraaj Party', color: '#999999', seats: 0 },
  { id: 'AIMIM', name: 'AIMIM', color: '#2BB673', seats: 5 },
  { id: 'HAMS', name: 'HAM(S)', color: '#E8C547', seats: 5 },
];
const alliances = [{ id: 'NDA', name: 'NDA', color: '#FF7A1A', parties: ['BJP', 'HAMS'] }];

describe('deriveStandingRows', () => {
  it('sorts by seats then name, drops zero-seat parties by default, tags alliances', () => {
    const rows = deriveStandingRows(parties, new Map([['BJP', 20.14]]), alliances);
    expect(rows.map(r => r.id)).toEqual(['BJP', 'RJD', 'AIMIM', 'HAMS']);
    expect(rows[0]).toMatchObject({ votePct: 20.1, allianceId: 'NDA' });
    expect(rows[1]).toMatchObject({ votePct: null, allianceId: null });
  });
  it('keeps zero-seat parties for the expanded table', () => {
    expect(deriveStandingRows(parties, new Map(), alliances, { includeZero: true })).toHaveLength(5);
  });
  it('returns no rows when nothing has been counted', () => {
    expect(deriveStandingRows(parties.map(p => ({ ...p, seats: 0 })), new Map(), alliances)).toEqual([]);
  });
});

describe('compactList', () => {
  it('reports hidden rows and their seats for the "+N more · M seats" footer', () => {
    const rows = deriveStandingRows(parties, new Map(), alliances);
    expect(compactList(rows, 2)).toMatchObject({ moreCount: 2, moreSeats: 10 });
    expect(compactList(rows, 2).visible.map(r => r.id)).toEqual(['BJP', 'RJD']);
  });
  it('has no footer when everything is visible', () => {
    expect(compactList([{ seats: 1 }], 5)).toEqual({ visible: [{ seats: 1 }], moreCount: 0, moreSeats: 0 });
  });
});
