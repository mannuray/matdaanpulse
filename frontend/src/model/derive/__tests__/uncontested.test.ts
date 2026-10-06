import { describe, it, expect } from 'vitest';
import { headlineMargin, isUncontested, isUnopposedWinner } from '../uncontested';
import { calculateMarginTrend, calculatePartyTrend } from '../intelligence';

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

describe('trends leave seats won unopposed out of margin averages', () => {
  const row = (const_id: string, party_id: string, votes: number, margin: number) => ({ const_id, party_id, candidate_name: 'x', votes, status: 'WON', margin });
  const results = [row('A', 'BJP', 900, 300), row('B', 'BJP', 700, 100), row('U', 'BJP', 0, 0)];
  it('calculateMarginTrend: average and median over contested seats; seats counts every winner', () => {
    expect(calculateMarginTrend([{ year: 2024, results }])).toEqual([{ year: 2024, avgMargin: 200, medianMargin: 200, seats: 3 }]);
  });
  it('calculatePartyTrend: seats won include the unopposed seat; the average margin does not', () => {
    expect(calculatePartyTrend([{ year: 2024, results }])).toEqual([{ party: 'BJP', year: 2024, seatsWon: 3, avgMargin: 200 }]);
  });
  it('isUnopposedWinner needs no votes and no margin (data with margins but no votes is not unopposed)', () => {
    expect(isUnopposedWinner({ status: 'WON', votes: 0, margin: 0 })).toBe(true);
    expect(isUnopposedWinner({ status: 'WON', votes: 0, margin: 1200 })).toBe(false);
  });
});
