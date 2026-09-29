import { describe, it, expect } from 'vitest';
import { deriveLayerInsight, type InsightContext } from '../layerInsights';
import type { SeatResult } from '../../types/dashboard';
import type { SwingEntry, DominanceEntry, ResultRow } from '../../types';

const s = (id: string, party: string, margin: number, type: 'GEN' | 'SC' | 'ST' = 'GEN', state?: string): SeatResult =>
  ({ id, name: id, party, margin, status: 'WON', type, state });

const alliances = [
  { id: 'NDA', name: 'NDA', color: '#FF7A1A', parties: ['BJP', 'JDU'] },
  { id: 'MGB', name: 'MGB', color: '#7BD34A', parties: ['RJD', 'INC'] },
];
const partyColor = new Map([['BJP', '#FF7A1A'], ['JDU', '#1FA37A'], ['RJD', '#7BD34A'], ['INC', '#38C6F4'], ['AIMIM', '#2BB673']]);
const seats = [s('A', 'JDU', 27, 'SC'), s('B', 'BJP', 800), s('C', 'BJP', 12000, 'ST'), s('D', 'RJD', 3000), s('E', 'JDU', 60000)];
const base: InsightContext = { electionType: 'VS', seats, alliances, partyColor };

const flip = (id: string, prev: string, cur: string): [string, SwingEntry] =>
  [id, { constId: id, prevParty: prev, currentParty: cur, currentMargin: 1, prevMargin: 1, flipped: prev !== cur }];

describe('deriveLayerInsight', () => {
  it('overview: bloc text and top parties', () => {
    const r = deriveLayerInsight('overview', base)!;
    expect(r.headlineKey).toBe('studio_insight_overview');
    expect(r.headlineParams.text).toBe('NDA 4 · MGB 1');
    expect(r.chips.map(c => [c.id, c.count])).toEqual([['BJP', 2], ['JDU', 2], ['RJD', 1]]);
  });

  it('battle: median, close seats and margin buckets', () => {
    const r = deriveLayerInsight('battle', base)!;
    expect(r.headlineParams).toEqual({ median: 3000, close: 2, threshold: 1000 });
    expect(r.chips.map(c => [c.label, c.count])).toEqual([['< 1K', 2], ['1–5K', 1], ['5–15K', 1], ['15–50K', 0], ['50K+', 1]]);
  });

  it('swing: flipped count and top flows; null without a previous election', () => {
    const swing = new Map([flip('A', 'RJD', 'JDU'), flip('B', 'RJD', 'BJP'), flip('E', 'RJD', 'JDU'), flip('D', 'RJD', 'RJD')]);
    const r = deriveLayerInsight('swing', { ...base, swing, prevYear: 2020 })!;
    expect(r.headlineParams).toEqual({ flipped: 3, total: 4, year: 2020 });
    expect(r.chips[0]).toMatchObject({ id: 'RJD>JDU', label: 'RJD → JDU', count: 2, fromColor: '#7BD34A', color: '#1FA37A', seatIds: ['A', 'E'] });
    expect(deriveLayerInsight('swing', { ...base, swing: new Map() })).toBeNull();
  });

  it('history: classification buckets and anti-incumbency', () => {
    const dominance = new Map<string, DominanceEntry>([
      ['A', { constId: 'A', winners: [], classification: 'stronghold', dominantParty: 'JDU', streak: 3 }],
      ['B', { constId: 'B', winners: [], classification: 'swing', streak: 1 }],
      ['C', { constId: 'C', winners: [], classification: 'loyal', dominantParty: 'BJP', streak: 2 }],
    ]);
    const r = deriveLayerInsight('history', { ...base, dominance, incumbency: [{ constId: 'D', incumbentName: 'x', incumbentParty: 'RJD', won: false, currentMargin: 1 }] })!;
    expect(r.headlineParams).toEqual({ strongholds: 1, swing: 1 });
    expect(r.chips.map(c => [c.labelKey, c.count])).toEqual([['studio_chip_stronghold', 1], ['studio_chip_loyal', 1], ['studio_chip_swing', 1], ['studio_chip_anti_incumbency', 1]]);
    expect(deriveLayerInsight('history', base)).toBeNull();
  });

  it('reserved: SC/ST counts and winners among reserved seats', () => {
    const r = deriveLayerInsight('demographics', base)!;
    expect(r.headlineParams).toEqual({ sc: 1, st: 1 });
    expect(r.chips.map(c => c.id)).toEqual(['BJP', 'JDU']);
  });

  it('insights: spoiler seats per vote-split config', () => {
    const cc = new Map<string, ResultRow[]>([
      ['A', [
        { const_id: 'A', party_id: 'JDU', candidate_name: 'w', votes: 1000, status: 'WON', margin: 27 },
        { const_id: 'A', party_id: 'RJD', candidate_name: 'r', votes: 973, status: 'LOST', margin: 0 },
        { const_id: 'A', party_id: 'AIMIM', candidate_name: 's', votes: 400, status: 'LOST', margin: 0 },
      ]],
    ]);
    const r = deriveLayerInsight('insights', { ...base, constCandidates: cc, voteSplits: [{ spoiler: 'AIMIM', hurts: 'MGB', label: 'AIMIM split' }] })!;
    expect(r.headlineKey).toBe('studio_insight_spoilers');
    expect(r.chips).toEqual([{ id: 'AIMIM', label: 'AIMIM split', color: '#2BB673', count: 1, seatIds: ['A'] }]);
  });

  it('insights without vote splits falls back to three-way contests', () => {
    const r = deriveLayerInsight('insights', { ...base, threeWaySeats: new Set(['B', 'C']) })!;
    expect(r).toMatchObject({ headlineKey: 'studio_insight_threeway', headlineParams: { count: 2 } });
  });

  it('states (LS): states led by each alliance', () => {
    const ls: InsightContext = { ...base, electionType: 'LS', seats: [s('AGRA', 'BJP', 1, 'GEN', 'Uttar Pradesh'), s('ALIGARH', 'BJP', 1, 'GEN', 'Uttar Pradesh'), s('PATNA', 'RJD', 1, 'GEN', 'Bihar'), s('X', 'INC', 1)] };
    const r = deriveLayerInsight('states', ls)!;
    expect(r.headlineParams).toEqual({ states: 2 });
    expect(r.chips.map(c => [c.id, c.count, c.seatIds.length])).toEqual([['NDA', 1, 2], ['MGB', 1, 1]]);
  });
});
