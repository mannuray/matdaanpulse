import { describe, expect, it } from 'vitest';
import { SHOWN_HOUSES, houseShown, visibleElections } from '../houses';

describe('shown houses (Lok Sabha hidden from the site; its data stays)', () => {
  it('shows only the Vidhan Sabha', () => {
    expect(SHOWN_HOUSES).toEqual(['VS']);
    expect(houseShown('LS')).toBe(false);
    expect(houseShown('VS')).toBe(true);
  });
  it('filters elections of hidden houses out of every list', () => {
    expect(visibleElections([{ id: 'l', type: 'LS' }, { id: 'v', type: 'VS' }]).map(e => e.id)).toEqual(['v']);
  });
});
