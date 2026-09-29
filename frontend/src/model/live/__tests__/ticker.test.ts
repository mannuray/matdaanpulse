import { describe, it, expect } from 'vitest';
import { appendTicker, MAX_TICKER } from '../ticker';

describe('appendTicker', () => {
  it('prepends newest events and caps the list', () => {
    const first = appendTicker([], [{ const_id: 'BR_VS_128_RAGHOPUR', party_id: 'RJD', margin: 400, kind: 'lead' }], 1000);
    expect(first[0]).toMatchObject({ constName: 'Raghopur', partyId: 'RJD', kind: 'lead', margin: 400, at: 1000 });
    let list = first;
    for (let i = 0; i < 30; i++) list = appendTicker(list, [{ const_id: `X${i}`, party_id: 'BJP', margin: i, kind: 'won' }], 2000 + i);
    expect(list).toHaveLength(MAX_TICKER);
    expect(list[0].constId).toBe('X29');
  });
  it('returns the same array when there are no changes', () => {
    const prev = appendTicker([], [{ const_id: 'A', party_id: 'BJP', margin: 1, kind: 'won' }], 1);
    expect(appendTicker(prev, [])).toBe(prev);
  });
});
