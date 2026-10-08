import { resolveLeaderSeats } from '../leaders';
import { describe, it, expect } from 'vitest';
import { manifestWatchlists, collectLeaderEntries, deriveLeaderCards } from '../leaders';
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

describe('manifestWatchlists (one sub-tab per manifest list)', () => {
  const e = (name: string, const_id = '', party_id = 'BJP') => ({ name, party_id, const_id });
  it('keeps every non-empty list with its own name, in manifest order (nothing hard-coded)', () => {
    const m = { watchlists: [
      { id: 'cm', name: 'CM faces', entries: [e('A', 'S1'), e('B', 'S2')] },
      { id: 'empty', name: 'Draft list', entries: [] },
      { id: 'turn', name: 'Turncoats', entries: [e('C', 'S3')] },
    ] };
    expect(manifestWatchlists(m).map(w => [w.id, w.name, w.entries.map(x => x.name)])).toEqual([
      ['cm', 'CM faces', ['A', 'B']],
      ['turn', 'Turncoats', ['C']],
    ]);
  });
  it('a person in two lists appears in both; a duplicate inside one list appears once', () => {
    const m = { watchlists: [
      { id: 'l', name: 'Leaders', entries: [e('Nitish Kumar'), e('Nitish Kumar')] },
      { id: 'c', name: 'Cabinet', entries: [e('Nitish Kumar'), e('Samrat', 'S9')] },
    ] };
    const out = manifestWatchlists(m);
    expect(out[0].entries.map(x => x.name)).toEqual(['Nitish Kumar']);
    expect(out[1].entries.map(x => x.name)).toEqual(['Nitish Kumar', 'Samrat']);
    expect(out[1].entries[1]).toMatchObject({ partyId: 'BJP', constId: 'S9', custom: false });
  });
  it('no manifest or no lists → none', () => {
    expect(manifestWatchlists(null)).toEqual([]);
    expect(manifestWatchlists({ alliances: [] })).toEqual([]);
  });
});

describe('deriveLeaderCards', () => {
  it('a leader who won unopposed has no margin and is flagged (not "+0")', () => {
    const w = new Map([['AR_VS24_3_MUKTO', { const_id: 'AR_VS24_3_MUKTO', party_id: 'BJP', candidate_name: 'PEMA KHANDU', votes: 0, status: 'WON', margin: 0 }]]);
    const [card] = deriveLeaderCards([{ name: 'Pema Khandu', partyId: 'BJP', constId: 'AR_VS24_3_MUKTO', custom: false }], w);
    expect([card.status, card.margin, card.unopposed]).toEqual(['WON', null, true]);
  });
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
  it('finds the seat of an entry with a person_id from the candidate rows (person_id match, not names)', () => {
    const e = { name: 'Rajesh Singh', partyId: 'JDU', constId: '', personId: 'p1', custom: false };
    const results = [{ const_id: 'BR_VS10_7_Y', party_id: 'JDU', candidate_name: 'R. SINGH', votes: 0, status: 'TRAILING', margin: 0, person_id: 'p1' }];
    expect(resolveLeaderSeats([e], results)[0].constId).toBe('BR_VS10_7_Y');
  });
  it('a seatless leader is Not contesting once the candidates are known, Pending before', () => {
    const e = { name: 'Nitish Kumar', partyId: 'JDU', constId: '', personId: 'p-nk', custom: false };
    expect(deriveLeaderCards([e], new Map(), true)[0]).toMatchObject({ status: 'NOT_CONTESTING', margin: null });
    expect(deriveLeaderCards([e], new Map(), false)[0].status).toBe('PENDING');
  });
  it('custom watch cards have no person', () => {
    expect(deriveLeaderCards(collectLeaderEntries(null, [{ const_id: 'X', label: 'X' }]), new Map())[0].personId).toBeNull();
  });
});
