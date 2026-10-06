import { describe, it, expect } from 'vitest';
import { headlineMargin, isUncontested } from '../uncontested';

const c = (party_id: string, votes: number, status: string) => ({ party_id, votes, status });

describe('isUncontested', () => {
  it('a declared seat whose only candidate won with no votes polled', () => {
    expect(isUncontested([c('BJP', 0, 'WON')])).toBe(true);
  });
  it('not while counting (LEADING at 0), not with a second candidate, not with votes', () => {
    expect(isUncontested([c('BJP', 0, 'LEADING')])).toBe(false);
    expect(isUncontested([c('BJP', 0, 'WON'), c('INC', 0, 'LOST')])).toBe(false);
    expect(isUncontested([c('BJP', 1200, 'WON')])).toBe(false);
    expect(isUncontested([])).toBe(false);
  });
  it('a NOTA row with no votes does not make it contested; NOTA votes do', () => {
    expect(isUncontested([c('BJP', 0, 'WON'), c('NOTA', 0, 'LOST')])).toBe(true);
    expect(isUncontested([c('BJP', 0, 'WON'), c('NOTA', 3, 'LOST')])).toBe(false);
  });
});

describe('headlineMargin', () => {
  it('a seat\'s headline margin: the winner\'s margin, none while pending, none for a seat won unopposed (flagged)', () => {
    const won = { party_id: 'BJP', votes: 900, status: 'WON', margin: 120 };
    expect(headlineMargin([won, { party_id: 'INC', votes: 780, status: 'LOST', margin: 120 }], won)).toEqual({ margin: 120 });
    expect(headlineMargin([], undefined)).toEqual({ margin: undefined });
    const alone = { party_id: 'BJP', votes: 0, status: 'WON', margin: 0 };
    expect(headlineMargin([alone], alone)).toEqual({ margin: undefined, uncontested: true });
  });
});
