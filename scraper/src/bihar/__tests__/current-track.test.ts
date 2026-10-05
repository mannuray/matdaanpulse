import { describe, it, expect } from 'vitest';
import { trackOf } from '../current-track';

describe('trackOf', () => {
  it('current-track years are the elections with a results site or MyNeta page (the latest assembly), not every new election', () => {
    expect(trackOf('DL').years).toEqual([2025]);
    expect(trackOf('OD').years).toEqual([2024]);
    expect(trackOf('WB').years).toEqual([2026]);
    expect(trackOf('UP').years).toEqual([]);
    expect(trackOf('BR').years).toEqual([2010, 2015, 2020, 2025]);
  });
});
