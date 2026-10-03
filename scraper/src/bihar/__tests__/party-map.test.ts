// scraper/src/bihar/__tests__/party-map.test.ts
import { describe, it, expect } from 'vitest';
import { resolveParty, suggestEntries, NEW_PARTY_COLOR } from '../party-map';
import type { PartyEntry, PartyListEntry } from '../types';

const list2010: PartyListEntry[] = [{ abbr: 'CPM', name: 'Communist Party of India (Marxist)', recognition: 'National' }];
const list2020: PartyListEntry[] = [{ abbr: 'CPI(M)', name: 'Communist Party of India  (Marxist)', recognition: 'National' }];
const cpim: PartyEntry = { id: 'CPIM', name: 'Communist Party of India (Marxist)', abbreviation: 'CPI(M)', color: '#FF0000', recognition: 'National' };
const map = { 'COMMUNIST PARTY OF INDIA MARXIST': cpim };

describe('resolveParty', () => {
  it('maps different abbreviations of one party through the full name', () => {
    expect(resolveParty('CPM', list2010, map)).toBe(cpim);
    expect(resolveParty('CPI(M)', list2020, map)).toBe(cpim);
  });
  it('handles IND and NOTA without the list', () => {
    expect(resolveParty('IND', [], {})).toMatchObject({ id: 'IND' });
    expect(resolveParty('NOTA', [], {})).toMatchObject({ id: 'NOTA' });
  });
  it('reports abbreviations missing from the list and names missing from the map', () => {
    expect(resolveParty('XYZ', list2010, map)).toEqual({ unknown: 'abbreviation XYZ is not in this year\'s party list' });
    expect(resolveParty('CPM', list2010, {})).toEqual({ unknown: 'no party-map entry for "Communist Party of India (Marxist)" (CPM)' });
  });
});

describe('suggestEntries', () => {
  const db: PartyEntry[] = [
    cpim,
    { id: 'VIP', name: 'Vikassheel Insaan Party', abbreviation: null, color: '#808080', recognition: null },
    { id: 'VSIP', name: 'Vikassheel Insaan Party', abbreviation: null, color: '#808080', recognition: null },
    { id: 'JJP', name: 'Jannayak Janta Party', abbreviation: 'JJP', color: '#808080', recognition: null },
  ];
  it('reuses an existing party with the same name', () => {
    expect(suggestEntries(list2020, db, {}).add).toEqual({ 'COMMUNIST PARTY OF INDIA MARXIST': cpim });
  });
  it('proposes a new party from the abbreviation with grey colour and list recognition', () => {
    const r = suggestEntries([{ abbr: 'JAPL', name: 'Jan Adhikar Party (Loktantrik)', recognition: 'Unrecognised' }], db, {});
    expect(r.add['JAN ADHIKAR PARTY LOKTANTRIK']).toEqual({ id: 'JAPL', name: 'Jan Adhikar Party (Loktantrik)', abbreviation: 'JAPL', color: NEW_PARTY_COLOR, recognition: 'Unrecognised' });
    expect(r.problems).toEqual([]);
  });
  it('flags a name held by two ids and an id taken by a different party', () => {
    const r = suggestEntries([
      { abbr: 'VSIP', name: 'Vikassheel Insaan Party', recognition: 'Unrecognised' },
      { abbr: 'JJP', name: 'Jagrook Janta Party', recognition: 'Unrecognised' },
    ], db, {});
    expect(r.problems).toEqual([
      'ambiguous: "Vikassheel Insaan Party" matches VIP, VSIP; add the entry by hand',
      'collision: id JJP for "Jagrook Janta Party" already belongs to "Jannayak Janta Party"; add the entry by hand',
    ]);
  });
  it('keeps entries already in the map', () => {
    expect(suggestEntries(list2020, db, map).add).toEqual({});
  });
});
