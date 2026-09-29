import { describe, it, expect } from 'vitest';
import { collectLeaderEntries, deriveLeaderCards } from '../leaders';
import type { ResultRow } from '../../types';

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
