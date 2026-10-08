// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { rememberElection, recallElectionId } from '../data/lastElection';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('last election per house', () => {
  it('stores the raw id under lastElection_<type> and reads it back, per house', () => {
    rememberElection('VS', 'br2020');
    rememberElection('LS', 'ls2019');
    expect(localStorage.getItem('lastElection_VS')).toBe('br2020');
    expect(recallElectionId('VS')).toBe('br2020');
    expect(recallElectionId('LS')).toBe('ls2019');
  });
  it('null forgets it; nothing stored reads as null', () => {
    rememberElection('VS', 'br2020');
    rememberElection('VS', null);
    expect(localStorage.getItem('lastElection_VS')).toBeNull();
    expect(recallElectionId('VS')).toBeNull();
  });
  it('unavailable storage is ignored', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => rememberElection('LS', 'x')).not.toThrow();
    expect(recallElectionId('LS')).toBeNull();
  });
});
