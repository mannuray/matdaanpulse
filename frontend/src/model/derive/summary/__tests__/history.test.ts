import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import type { DominanceEntry, IncumbencyEntry, PartySwitchEntry } from '../../../types';
import { makeCtx } from './fixtures';

const dom = (constId: string, classification: DominanceEntry['classification'], dominantParty?: string, winners: string[] = []): [string, DominanceEntry] =>
  [constId, { constId, classification, dominantParty, winners: winners.map(party => ({ party })), streak: 1 }];
const dominance = new Map([dom('A', 'stronghold', 'BJP'), dom('B', 'stronghold', 'BJP'), dom('C', 'loyal', 'RJD'), dom('D', 'swing', undefined, ['BJP', 'RJD', 'JDU']), dom('E', 'new'), dom('G', 'swing', undefined, ['JDU', 'AIMIM'])]);
const inc = (constId: string, incumbentParty: string, won: boolean, currentMargin: number): IncumbencyEntry =>
  ({ constId, incumbentName: 'Ram Kumar Singh', incumbentParty, won, currentMargin });
const incumbency = [inc('A', 'BJP', true, 800), inc('B', 'BJP', false, 12000), inc('C', 'RJD', false, 3000), inc('D', 'JDU', true, 60000), inc('E', 'RJD', true, 400)];
const sw = (fromParty: string, toParty: string, wonInNewParty: boolean): PartySwitchEntry =>
  ({ constId: 'A', candidateName: 'X', fromParty, toParty, fromYear: 2015, toYear: 2020, wonInNewParty, margin: 1 });
const partySwitches = [sw('RJD', 'JDU', true), sw('RJD', 'JDU', false), sw('INC', 'BJP', true)];
const marginTrend = [{ year: 2015, avgMargin: 10000, medianMargin: 8000, seats: 243 }, { year: 2020, avgMargin: 20000, medianMargin: 15000, seats: 243 }];
const partyTrend = [
  { party: 'BJP', year: 2015, seatsWon: 20, avgMargin: 1 }, { party: 'BJP', year: 2020, seatsWon: 30, avgMargin: 1 },
  { party: 'RJD', year: 2015, seatsWon: 80, avgMargin: 1 }, { party: 'RJD', year: 2020, seatsWon: 60, avgMargin: 1 },
  { party: 'JDU', year: 2015, seatsWon: 70, avgMargin: 1 },
];
const full = { dominance, incumbency, partySwitches, marginTrend, partyTrend };
const run = (over = {}) => deriveLayerSummary('history', makeCtx({ ...full, ...over })).sections.filter(s => s.id !== 'key_stats');
const get = (id: string, over = {}) => run(over).find(s => s.id === id)!;
const nums = (id: string, over = {}) => get(id, over).rows.map(r => [r.id, r.value, r.extra?.map(x => x.value)]);

describe('history summary', () => {
  it('sections in the binding order', () => {
    expect(run().map(s => s.id)).toEqual(['dominance', 'dominance_by_party', 'swing_seats', 'anti_incumbency', 'incumbent_win_rate', 'incumbent_defeats', 'party_switchers', 'switch_directions', 'notable_switchers', 'margin_trend', 'party_trend']);
  });

  it('dominance: stronghold / loyal / swing numbers (new seats are not shown, as in the legacy)', () => {
    // HistorySection.tsx:52-69 classification tally, shown as three numbers.
    expect(nums('dominance')).toEqual([['class:stronghold', 2, undefined], ['class:loyal', 1, undefined], ['class:swing', 2, undefined]]);
    expect(get('dominance').layout).toBe('stats');
    expect(get('dominance').rows[0]).toMatchObject({ labelKey: 'studio_chip_stronghold', seatIds: ['A', 'B'] });
  });

  it('dominance_by_party: strongholds and loyal seats of the dominant party, biggest first', () => {
    // HistorySection.tsx:54-66,76: per dominantParty { stronghold, loyal, total }, sorted by total desc.
    expect(nums('dominance_by_party')).toEqual([['party:BJP', 2, [0, 2]], ['party:RJD', 0, [1, 1]]]);
    // The compact card shows the primary column, which is the total the list is sorted by.
    expect(get('dominance_by_party').primaryCol).toBe(2);
    expect(get('dominance_by_party').columnsKeys![2]).toBe('studio_col_total');
    expect(get('dominance_by_party').rows[0].label).toBe('Bharatiya Janata Party');
  });

  it('swing_seats: winners history and current margin', () => {
    expect(get('swing_seats').rows.map(r => [r.label, r.sub, r.value])).toEqual([['D', 'BJP → RJD → JDU', 60000], ['G', 'JDU → AIMIM', 30000]]);
    expect(get('swing_seats').titleParams).toEqual({ count: 2 });
    const many = new Map(Array.from({ length: 20 }, (_, i) => dom(`S${i}`, 'swing', undefined, ['BJP', 'RJD'])));
    expect(get('swing_seats', { dominance: many }).rows).toHaveLength(15);
  });

  it('anti_incumbency: re-contested, won and win rate as three numbers', () => {
    // HistorySection.tsx:146-149: total 5, won 3, winRate = round(3/5*100) = 60.
    expect(nums('anti_incumbency')).toEqual([['recontested', 5, undefined], ['won', 3, undefined], ['win_rate', 60, undefined]]);
    expect(get('anti_incumbency').layout).toBe('stats');
  });

  it('incumbent_win_rate: per party contested / won / rate', () => {
    // HistorySection.tsx:151-163: BJP 1/2 = 50, RJD 1/2 = 50 (contested tie keeps insertion order), JDU 1/1 = 100.
    expect(nums('incumbent_win_rate')).toEqual([['party:BJP', 2, [1, 50]], ['party:RJD', 2, [1, 50]], ['party:JDU', 1, [1, 100]]]);
    // Legacy columns: Contested, Won, Rate (the compact card shows the rate).
    expect(get('incumbent_win_rate').columnsKeys).toEqual(['studio_col_contested', 'studio_col_won', 'studio_col_win_rate']);
    expect(get('incumbent_win_rate').primaryCol).toBe(2);
  });

  it('incumbent_defeats: closest defeats first with the incumbent\'s first two names', () => {
    // HistorySection.tsx:165-172: lost entries by currentMargin asc, top 10, name split(' ').slice(0, 2).
    expect(get('incumbent_defeats').rows.map(r => [r.label, r.sub, r.value])).toEqual([['C', 'Ram Kumar', 3000], ['B', 'Ram Kumar', 12000]]);
  });

  it('party_switchers and switch_directions', () => {
    // HistorySection.tsx:250-251: 3 switchers, 2 won, success round(2/3*100) = 67.
    expect(nums('party_switchers')).toEqual([['switchers', 3, undefined], ['switchers_won', 2, undefined], ['success_rate', 67, undefined]]);
    // HistorySection.tsx:238-245: RJD→JDU 2 (1 won) then INC→BJP 1 (1 won).
    expect(get('switch_directions').rows.map(r => [r.label, r.value, r.extra![0].value])).toEqual([['RJD → JDU', 2, 1], ['INC → BJP', 1, 1]]);
  });

  it('notable_switchers: first 20 with from -> to, years, margin and result; the header counts all', () => {
    const s = get('notable_switchers');
    expect(s.titleParams).toEqual({ count: 3 });
    expect(s.rows[0]).toMatchObject({ label: 'X', sub: 'RJD → JDU · 2015→2020', value: 1, valueFormat: 'compact', extra: [{ value: 1, format: 'result' }] });
    expect(s.rows[1].extra).toEqual([{ value: 0, format: 'result' }]);
    const many = Array.from({ length: 25 }, () => sw('RJD', 'JDU', true));
    expect(get('notable_switchers', { partySwitches: many }).rows).toHaveLength(20);
    expect(get('notable_switchers', { partySwitches: many }).titleParams).toEqual({ count: 25 });
  });

  it('margin_trend: rows and a line chart with average and median by year', () => {
    const s = get('margin_trend');
    expect(s.rows.map(r => [r.label, r.value, r.extra!.map(x => x.value)])).toEqual([['2015', 10000, [8000, 243]], ['2020', 20000, [15000, 243]]]);
    expect(s.chart!.type).toBe('line');
    expect(s.chart!.series.map(x => [x.id, x.points])).toEqual([
      ['avg', [{ x: 2015, y: 10000 }, { x: 2020, y: 20000 }]],
      ['median', [{ x: 2015, y: 8000 }, { x: 2020, y: 15000 }]],
    ]);
  });

  it('party_trend: parties present in 2+ elections, ordered by latest seats, a seats/avg-margin cell per election', () => {
    // HistorySection.tsx:336-342: JDU has one year -> skipped; RJD (60) before BJP (30) by latest-year seats.
    const s = get('party_trend');
    expect(s.columnsKeys).toEqual(['2015', '2020']);
    expect(s.rows.map(r => [r.id, r.valueText, r.extra![0].text])).toEqual([['party:RJD', '80/1', '60/1'], ['party:BJP', '20/1', '30/1']]);
    expect(s.primaryCol).toBe(1);
    expect(s.chart!.series.map(x => [x.id, x.points.map(p => p.y)])).toEqual([['RJD', [80, 60]], ['BJP', [20, 30]]]);
    expect(s.chart!.series[0].color).toBe('#7BD34A');
  });

  it('party_trend lists every party but charts the top 6', () => {
    const many = Array.from({ length: 8 }, (_, i) => [2015, 2020].map(year => ({ party: `P${i}`, year, seatsWon: i + (year === 2020 ? 10 : 0), avgMargin: 1 }))).flat();
    expect(get('party_trend', { partyTrend: many }).chart!.series.map(x => x.id)).toEqual(['P7', 'P6', 'P5', 'P4', 'P3', 'P2']);
    expect(get('party_trend', { partyTrend: many }).rows).toHaveLength(8);
  });

  it('omits sections whose data is missing', () => {
    expect(run({ dominance: new Map() }).map(s => s.id)).not.toContain('dominance');
    expect(run({ incumbency: [] }).map(s => s.id)).not.toContain('anti_incumbency');
    expect(run({ partySwitches: [] }).map(s => s.id)).not.toContain('switch_directions');
    // Legacy MarginTrendSection needed 2+ elections (HistorySection.tsx:346).
    const one = run({ marginTrend: [marginTrend[0]] }).map(s => s.id);
    expect(one).not.toContain('margin_trend');
    expect(one).not.toContain('party_trend');
    expect(run({ partyTrend: [] }).map(s => s.id)).toContain('margin_trend');
    expect(run({ partyTrend: [] }).map(s => s.id)).not.toContain('party_trend');
    expect(run({ dominance: new Map(), incumbency: [], partySwitches: [], marginTrend: [] })).toEqual([]);
  });
});
