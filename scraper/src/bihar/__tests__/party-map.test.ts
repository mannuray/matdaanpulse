// scraper/src/bihar/__tests__/party-map.test.ts
import { describe, it, expect } from 'vitest';
import { resolveParty, suggestEntries, NEW_PARTY_COLOR } from '../party-map';
import type { PartyEntry, PartyListEntry } from '../types';

const list2010: PartyListEntry[] = [{ abbr: 'CPM', name: 'Communist Party of India (Marxist)', recognition: 'National' }];
const list2020: PartyListEntry[] = [{ abbr: 'CPI(M)', name: 'Communist Party of India  (Marxist)', recognition: 'National' }];
const cpim: PartyEntry = { id: 'CPIM', name: 'Communist Party of India (Marxist)', abbreviation: 'CPI(M)', color: '#FF0000', recognition: 'National' };
const map = { COMMUNISTPARTYOFINDIAMARXIST: cpim };

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
  it('reuses an existing party with the same name, ignoring spacing', () => {
    expect(suggestEntries(list2020, db, {}).add).toEqual({ COMMUNISTPARTYOFINDIAMARXIST: cpim });
    const ljp: PartyEntry = { id: 'LJP', name: 'Lok Janshakti Party', abbreviation: null, color: '#0000CD', recognition: null };
    expect(suggestEntries([{ abbr: 'LJP', name: 'Lok Jan Shakti Party', recognition: 'State' }], [ljp], {}).add).toEqual({ LOKJANSHAKTIPARTY: ljp });
  });
  it('proposes a new party from the abbreviation with grey colour and list recognition', () => {
    const r = suggestEntries([{ abbr: 'JAPL', name: 'Jan Adhikar Party (Loktantrik)', recognition: 'Unrecognised' }], db, {});
    expect(r.add['JANADHIKARPARTYLOKTANTRIK']).toEqual({ id: 'JAPL', name: 'Jan Adhikar Party (Loktantrik)', abbreviation: 'JAPL', color: NEW_PARTY_COLOR, recognition: 'Unrecognised' });
    expect(r.problems).toEqual([]);
  });
  it('picks the most used id when the DB holds the name twice, and notes it', () => {
    const counted = db.map(d => ({ ...d, candidates: d.id === 'VSIP' ? 40 : d.id === 'VIP' ? 3 : 0 }));
    const r = suggestEntries([{ abbr: 'VSIP', name: 'Vikassheel Insaan Party', recognition: 'Unrecognised' }], counted, {});
    expect(r.add.VIKASSHEELINSAANPARTY.id).toBe('VSIP');
    expect(r.notes).toEqual(['duplicate ids in DB for "Vikassheel Insaan Party": VSIP (40), VIP (3); using VSIP']);
    expect(r.problems).toEqual([]);
    expect(r.aliases).toEqual({ VIP: 'VSIP' });
  });
  it('suffixes a new id taken by a different party with _BR, and flags it only when that is taken too', () => {
    const r = suggestEntries([{ abbr: 'JJP', name: 'Jagrook Janta Party', recognition: 'Unrecognised' }], db, {});
    expect(r.add.JAGROOKJANTAPARTY.id).toBe('JJP_BR');
    const taken = [...db, { id: 'JJP_BR', name: 'Other', abbreviation: null, color: '#808080', recognition: null }];
    expect(suggestEntries([{ abbr: 'JJP', name: 'Jagrook Janta Party', recognition: 'Unrecognised' }], taken, {}).problems)
      .toEqual(['collision: ids JJP and JJP_BR for "Jagrook Janta Party" are taken; add the entry by hand']);
  });
  it('reports each problem once even when the party appears in several years', () => {
    const taken = [...db, { id: 'JJP_BR', name: 'Other', abbreviation: null, color: '#808080', recognition: null }];
    const e = { abbr: 'JJP', name: 'Jagrook Janta Party', recognition: 'Unrecognised' as const };
    expect(suggestEntries([e, e], taken, {}).problems).toHaveLength(1);
  });
  it('keeps entries already in the map', () => {
    expect(suggestEntries(list2020, db, map).add).toEqual({});
  });
});
