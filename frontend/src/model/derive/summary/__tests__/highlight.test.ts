import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import type { LayerId } from '../../../types/dashboard';
import type { DominanceEntry, IncumbencyEntry, PartySwitchEntry, SwingEntry } from '../../../types';
import { cand, makeCtx, seat } from './fixtures';
import type { SummaryContext, SummarySection } from '../types';

// Seats: A BJP 800 | B BJP SC 12000 | C RJD ST 3000 | D JDU 60000 | E RJD SC 400 | F pending | G AIMIM 30000 | H pending SC
const dom = (constId: string, classification: DominanceEntry['classification'], dominantParty?: string, winners: string[] = []): [string, DominanceEntry] =>
  [constId, { constId, classification, dominantParty, winners: winners.map(party => ({ party })), streak: 1 }];
const sw = (constId: string, prev: string, cur: string, margin: number): [string, SwingEntry] =>
  [constId, { constId, prevParty: prev, currentParty: cur, currentMargin: margin, prevMargin: 1, flipped: prev !== cur }];
const inc = (constId: string, incumbentParty: string, won: boolean, currentMargin: number): IncumbencyEntry =>
  ({ constId, incumbentName: 'Ram Kumar', incumbentParty, won, currentMargin });
const psw = (constId: string, fromParty: string, toParty: string, wonInNewParty: boolean): PartySwitchEntry =>
  ({ constId, candidateName: 'X', fromParty, toParty, fromYear: 2015, toYear: 2020, wonInNewParty, margin: 1 });

const cc = new Map([
  ['A', [cand('A', 'BJP', 1000), cand('A', 'RJD', 900), cand('A', 'AIMIM', 500)]],
  ['D', [cand('D', 'JDU', 1000), cand('D', 'RJD', 400), cand('D', 'INC', 100)]],
]);

const ctx = (over: Partial<SummaryContext> = {}) => makeCtx({
  swing: new Map([sw('A', 'RJD', 'BJP', 800), sw('B', 'BJP', 'BJP', 12000), sw('C', 'BJP', 'RJD', 3000), sw('D', 'RJD', 'JDU', 60000)]),
  dominance: new Map([dom('A', 'stronghold', 'BJP'), dom('B', 'loyal', 'BJP'), dom('C', 'swing', undefined, ['RJD', 'BJP']), dom('D', 'new')]),
  incumbency: [inc('A', 'BJP', true, 800), inc('B', 'BJP', false, 12000), inc('C', 'RJD', false, 3000)],
  partySwitches: [psw('A', 'RJD', 'BJP', true), psw('C', 'RJD', 'BJP', false), psw('D', 'INC', 'JDU', true)],
  marginTrend: [{ year: 2015, avgMargin: 10000, medianMargin: 8000, seats: 8 }, { year: 2020, avgMargin: 20000, medianMargin: 15000, seats: 8 }],
  partyTrend: [
    { party: 'BJP', year: 2015, seatsWon: 1, avgMargin: 1 }, { party: 'BJP', year: 2020, seatsWon: 2, avgMargin: 1 },
    { party: 'RJD', year: 2015, seatsWon: 1, avgMargin: 1 }, { party: 'RJD', year: 2020, seatsWon: 2, avgMargin: 1 },
  ],
  constCandidates: cc,
  voteSplits: [{ spoiler: 'AIMIM', hurts: 'MGB', label: 'AIMIM split' }],
  ...over,
});
const sections = (layer: LayerId, over: Partial<SummaryContext> = {}) => deriveLayerSummary(layer, ctx(over)).sections;
const row = (layer: LayerId, sectionId: string, rowId: string, over: Partial<SummaryContext> = {}) =>
  sections(layer, over).find(s => s.id === sectionId)!.rows.find(r => r.id === rowId)!;
const ids = (r: { seatIds?: string[] }) => [...(r.seatIds ?? [])].sort();

describe('summary rows name their exact seats', () => {
  it('closest / biggest: that one seat', () => {
    expect(row('overview', 'closest', 'seat:E').seatIds).toEqual(['E']);
    expect(row('battle', 'closest', 'seat:A').seatIds).toEqual(['A']);
    expect(row('overview', 'biggest', 'seat:D').seatIds).toEqual(['D']);
  });
  it('margin_dist: the seats of the bucket', () => {
    expect(ids(row('overview', 'margin_dist', 'bucket:0'))).toEqual(['A', 'E']);
  });
  it('reserved: only the SC/ST seats of that party', () => {
    expect(ids(row('overview', 'reserved', 'party:BJP'))).toEqual(['B']);
    expect(ids(row('overview', 'reserved', 'party:RJD'))).toEqual(['C', 'E']);
  });
  it('vote_vs_seats: seats led by the alliance / party', () => {
    expect(ids(row('overview', 'vote_vs_seats_alliances', 'alliance:NDA'))).toEqual(['A', 'B', 'D']);
    expect(ids(row('overview', 'vote_vs_seats_alliances', 'others'))).toEqual(['G']);
    expect(ids(row('overview', 'vote_vs_seats_parties', 'party:RJD'))).toEqual(['C', 'E']);
  });
  it('wasted: seats won by the alliance; efficiency gap highlights nothing', () => {
    expect(ids(row('overview', 'wasted', 'alliance:MGB'))).toEqual(['C', 'E']);
    expect(row('overview', 'wasted', 'efficiency_gap').seatIds).toBeUndefined();
  });
  it('net_swing: seats gained by the bloc', () => {
    expect(ids(row('swing', 'net_swing', 'bloc:NDA'))).toEqual(['A', 'D']);
    expect(ids(row('swing', 'net_swing', 'bloc:MGB'))).toEqual(['C']);
  });
  it('flipped: that one seat', () => {
    expect(row('swing', 'flipped', 'seat:C').seatIds).toEqual(['C']);
  });
  it('dominance classes and dominance_by_party', () => {
    expect(row('history', 'dominance', 'class:stronghold').seatIds).toEqual(['A']);
    expect(ids(row('history', 'dominance_by_party', 'party:BJP'))).toEqual(['A', 'B']);
  });
  it('swing_seats / incumbent_defeats / notable switchers: that one seat', () => {
    expect(row('history', 'swing_seats', 'seat:C').seatIds).toEqual(['C']);
    expect(row('history', 'incumbent_defeats', 'seat:B').seatIds).toEqual(['B']);
    expect(row('history', 'notable_switchers', 'switcher:D:2').seatIds).toEqual(['D']);
  });
  it('switch_directions: only the seats that switched A -> B', () => {
    expect(ids(row('history', 'switch_directions', 'dir:RJD→BJP'))).toEqual(['A', 'C']);
    expect(ids(row('history', 'switch_directions', 'dir:INC→JDU'))).toEqual(['D']);
  });
  it('incumbent_win_rate / party_trend: the seats that party leads now', () => {
    expect(ids(row('history', 'incumbent_win_rate', 'party:BJP'))).toEqual(['A', 'B']);
    expect(ids(row('history', 'party_trend', 'party:RJD'))).toEqual(['C', 'E']);
  });
  it('anti_incumbency: recontested / won / win rate', () => {
    expect(ids(row('history', 'anti_incumbency', 'recontested'))).toEqual(['A', 'B', 'C']);
    expect(ids(row('history', 'anti_incumbency', 'won'))).toEqual(['A']);
    expect(row('history', 'anti_incumbency', 'win_rate').seatIds).toBeUndefined();
  });
  it('category_breakdown and per-bloc category rows', () => {
    expect(ids(row('demographics', 'category_breakdown', 'cat:SC'))).toEqual(['B', 'E', 'H']);
    expect(ids(row('demographics', 'win_rate_by_category', 'bloc:MGB'))).toEqual(['C', 'E']);
    expect(ids(row('demographics', 'margin_by_category', 'bloc:NDA'))).toEqual(['A', 'B', 'D']);
  });
  it('vote_split / classification: the seats of that class', () => {
    expect(row('insights', 'vote_split', 'three_way').seatIds).toEqual(['A']);
    expect(row('insights', 'vote_split', 'analyzed').seatIds).toBeUndefined();
    expect(row('insights', 'classification', 'two_way').seatIds).toEqual(['D']);
  });
  it('states: the seats of the state', () => {
    const seats = [seat('A', 'BJP', 100, 'GEN', 'Bihar'), seat('B', 'RJD', 200, 'GEN', 'Bihar'), seat('C', 'BJP', 300, 'GEN', 'Kerala')];
    const s = deriveLayerSummary('states', ctx({ electionType: 'LS', seats })).sections.find(x => x.id === 'state_leaderboard')!;
    expect(s.rows.map(r => ids(r))).toEqual([['A', 'B'], ['C']]);
  });
});

describe('seats of earlier elections', () => {
  it('are dropped from a row, which then names no seats (plain text, nothing to highlight)', () => {
    const r = row('history', 'switch_directions', 'dir:INC→JDU', { partySwitches: [psw('OLD_SEAT_2015', 'INC', 'JDU', true)] });
    expect(r.seatIds).toEqual([]);
    const mixed = row('history', 'switch_directions', 'dir:RJD→BJP', { partySwitches: [psw('A', 'RJD', 'BJP', true), psw('OLD_SEAT_2015', 'RJD', 'BJP', true)] });
    expect(mixed.seatIds).toEqual(['A']);
  });
  it('a switcher mapped to a current seat id keeps its highlight', () => {
    const r2 = row('history', 'notable_switchers', 'switcher:C:0', { partySwitches: [psw('C', 'INC', 'JDU', true)] });
    expect(r2.seatIds).toEqual(['C']);
  });
});

describe('invariant: every row seatIds is a subset of the known seats', () => {
  const layers: LayerId[] = ['overview', 'battle', 'swing', 'history', 'demographics', 'insights', 'states'];
  for (const layer of layers) {
    it(layer, () => {
      const c = ctx(layer === 'states' ? { electionType: 'LS', seats: ctx().seats.map(s => ({ ...s, state: 'Bihar' })) } : {});
      const known = new Set(c.seats.map(s => s.id));
      const secs: SummarySection[] = deriveLayerSummary(layer, c).sections;
      let withSeats = 0;
      for (const s of secs) for (const r of s.rows) {
        (r.seatIds ?? []).forEach(id => expect(known.has(id), `${s.id}/${r.id}: ${id}`).toBe(true));
        if (r.seatIds?.length) withSeats++;
      }
      expect(withSeats).toBeGreaterThan(0);
    });
  }
});
