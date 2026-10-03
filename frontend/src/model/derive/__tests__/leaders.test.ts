import { resolveLeaderSeats } from '../leaders';
import { describe, it, expect } from 'vitest';
import { collectLeaderEntries, deriveLeaderCards } from '../leaders';
import type { ManifestData, ResultRow } from '../../types';

const winners = new Map<string, ResultRow>([
  ['BR_VS_128_RAGHOPUR', { const_id: 'BR_VS_128_RAGHOPUR', party_id: 'RJD', candidate_name: 'TEJASHWI PRASAD YADAV', votes: 1, status: 'WON', margin: 14532 }],
  ['BR_VS_164_TARAPUR', { const_id: 'BR_VS_164_TARAPUR', party_id: 'BJP', candidate_name: 'SAMRAT CHOUDHARY', votes: 1, status: 'LEADING', margin: 200 }],
]);

describe('collectLeaderEntries', () => {
  it('flattens watchlists, de-duplicates, then appends custom seats', () => {
    const manifest = { watchlists: [
      { id: 'a', name: 'Leaders', entries: [{ name: 'Tejashwi Yadav', party_id: 'RJD', const_id: 'BR_VS_128_RAGHOPUR' }] },
      { id: 'b', name: 'Cabinet', entries: [{ name: 'Tejashwi Yadav', party_id: 'RJD', const_id: 'BR_VS_128_RAGHOPUR', role: 'LoP' }] },
    ] };
    const e = collectLeaderEntries(manifest, [{ const_id: 'BR_VS_164_TARAPUR', label: 'Tarapur' }]);
    expect(e.map(x => [x.constId, x.custom])).toEqual([['BR_VS_128_RAGHOPUR', false], ['BR_VS_164_TARAPUR', true]]);
  });
  it('falls back to legacy leaders/cabinet when there are no watchlists', () => {
    const e = collectLeaderEntries({ leaders: [{ name: 'X', party_id: 'BJP', const_id: 'C1' }], cabinet: [{ name: 'Y', role: 'Min', party_id: 'JDU', const_id: 'C2' }] }, []);
    expect(e.map(x => x.constId)).toEqual(['C1', 'C2']);
    expect(e[1].role).toBe('Min');
  });
  it('returns an empty list without a manifest', () => {
    expect(collectLeaderEntries(null, [])).toEqual([]);
  });
});

describe('deriveLeaderCards', () => {
  it('marks won/leading when the leader is the entry party, lost/trailing otherwise, pending with no result', () => {
    const cards = deriveLeaderCards([
      { name: 'Tejashwi Yadav', partyId: 'RJD', constId: 'BR_VS_128_RAGHOPUR', custom: false },
      { name: 'Rival', partyId: 'INC', constId: 'BR_VS_164_TARAPUR', custom: false },
      { name: 'Unknown', partyId: 'BJP', constId: 'BR_VS_1_X', custom: false },
      { name: 'Tarapur', partyId: '', constId: 'BR_VS_164_TARAPUR', custom: true },
    ], winners);
    expect(cards.map(c => [c.status, c.margin])).toEqual([['WON', 14532], ['TRAILING', 200], ['PENDING', null], ['LEADING', 200]]);
    expect(cards[3].name).toBe('SAMRAT CHOUDHARY');
    expect(cards[0].constName).toBe('Raghopur');
  });
});

describe('resolveLeaderSeats', () => {
  const rows = [
    { const_id: 'BR_VS_128_RAGHOPUR', party_id: 'RJD', candidate_name: 'TEJASHWI PRASAD YADAV', votes: 1, status: 'WON', margin: 1 },
    { const_id: 'BR_VS_1_X', party_id: 'RJD', candidate_name: 'TEJ PRATAP YADAV', votes: 1, status: 'LOST', margin: 0 },
    { const_id: 'BR_VS_2_Y', party_id: 'BJP', candidate_name: 'TEJASHWI YADAV', votes: 1, status: 'LOST', margin: 0 },
  ];
  it('fills a missing seat from a same-party candidate whose name contains every token', () => {
    const out = resolveLeaderSeats([{ name: 'Tejashwi Yadav', partyId: 'RJD', constId: '', custom: false }], rows);
    expect(out[0].constId).toBe('BR_VS_128_RAGHOPUR');
  });
  it('keeps a seat that is already set, and leaves an unmatched leader seatless', () => {
    const out = resolveLeaderSeats([
      { name: 'Tejashwi Yadav', partyId: 'RJD', constId: 'BR_VS_9_Z', custom: false },
      { name: 'Nitish Kumar', partyId: 'JDU', constId: '', custom: false },
    ], rows);
    expect(out.map(e => e.constId)).toEqual(['BR_VS_9_Z', '']);
  });
  it('does not guess when two same-party candidates match', () => {
    const two = [...rows, { const_id: 'BR_VS_3_W', party_id: 'RJD', candidate_name: 'TEJASHWI YADAV', votes: 1, status: 'LOST', margin: 0 }];
    expect(resolveLeaderSeats([{ name: 'Tejashwi Yadav', partyId: 'RJD', constId: '', custom: false }], two)[0].constId).toBe('');
  });
});

describe('person_id on leader entries', () => {
  it('carries person_id from watchlist entries to the cards', () => {
    const manifest = { watchlists: [{ id: 'leaders', name: 'Leaders', entries: [{ name: 'Nitish Kumar', party_id: 'JDU', const_id: '', role: 'Chief Minister', person_id: 'p-nk' }] }] } as unknown as ManifestData;
    const [e] = collectLeaderEntries(manifest, []);
    expect(e.personId).toBe('p-nk');
    expect(deriveLeaderCards([e], new Map())[0].personId).toBe('p-nk');
  });
  it('never name-matches an entry that has a person_id', () => {
    const e = { name: 'Rajesh Singh', partyId: 'JDU', constId: '', personId: 'p1', custom: false };
    const results = [{ const_id: 'BR_VS10_1_X', party_id: 'JDU', candidate_name: 'Rajesh Singh', votes: 1, status: 'WON', margin: 1 }];
    expect(resolveLeaderSeats([e], results)[0].constId).toBe('');
  });
  it('custom watch cards have no person', () => {
    expect(deriveLeaderCards(collectLeaderEntries(null, [{ const_id: 'X', label: 'X' }]), new Map())[0].personId).toBeNull();
  });
});
