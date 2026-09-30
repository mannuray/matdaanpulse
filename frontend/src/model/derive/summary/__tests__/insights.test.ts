import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { cand, makeCtx, seat } from './fixtures';

const splits = [{ spoiler: 'AIMIM', hurts: 'MGB', label: 'AIMIM split' }];
const cc = new Map([
  // Winner NDA by 100, runner-up RJD (MGB), AIMIM 500 > 100 -> spoiler seat. Top two 79.2% (< 80), third 20.8% (>= 15), 3 above 10%.
  ['s1', [cand('s1', 'BJP', 1000), cand('s1', 'RJD', 900), cand('s1', 'AIMIM', 500)]],
  // Margin 50, AIMIM only 20 -> not a spoiler; top two 97.5% -> two-way; only 2 above 10%.
  ['s2', [cand('s2', 'JDU', 1000), cand('s2', 'RJD', 950), cand('s2', 'IND', 30), cand('s2', 'AIMIM', 20)]],
  // Runner-up BJP is in NDA, the config hurts MGB -> not counted; top two 86.4% -> two-way; 45.5 / 40.9 / 13.6 -> 3 above 10%.
  ['s3', [cand('s3', 'RJD', 1000), cand('s3', 'BJP', 900), cand('s3', 'AIMIM', 300)]],
  // Fewer than 3 candidates: not analysed.
  ['s4', [cand('s4', 'BJP', 500), cand('s4', 'RJD', 400)]],
]);
const run = (over = {}) => deriveLayerSummary('insights', makeCtx({ constCandidates: cc, voteSplits: splits, seats: [...makeCtx().seats, ...['s1', 's2', 's3', 's4'].map(id => seat(id, 'BJP', 100))], ...over })).sections.filter(s => s.id !== 'key_stats');
const get = (id: string, over = {}) => run(over).find(s => s.id === id)!;

describe('insights summary', () => {
  it('sections in the binding order', () => {
    expect(run().map(s => s.id)).toEqual(['vote_split', 'split:AIMIM', 'classification']);
  });

  it('vote_split: analysed, three-way and spoiler-affected as three numbers', () => {
    const s = get('vote_split');
    expect(s.layout).toBe('stats');
    expect(s.rows.map(r => [r.id, r.value])).toEqual([['analyzed', 3], ['three_way', 1], ['spoiler_affected', 1]]);
  });

  it('one section per split: seats where the spoiler outpolled the margin and the runner-up is in the hurt alliance', () => {
    // InsightsSection.tsx:75-100: matches the runner-up alliance, spoiler votes 500 > margin 100.
    const s = get('split:AIMIM');
    expect(s.titleParams).toEqual({ label: 'AIMIM split', count: 1, hurts: 'MGB' });
    expect(s.rows.map(r => [r.id, r.label, r.sub, r.value, r.extra?.map(e => e.value)])).toEqual([['split:AIMIM:s1', 's1', 'NDA', 100, [500]]]);
    expect(s.rows[0]).toMatchObject({ seatIds: ['s1'], partyIds: ['AIMIM'], color: '#2BB673', valueFormat: 'compact' });
    expect(s.more).toBe(0);
    const many = new Map(Array.from({ length: 13 }, (_, i) => [`m${i}`, [cand(`m${i}`, 'BJP', 1000), cand(`m${i}`, 'RJD', 900), cand(`m${i}`, 'AIMIM', 500)]] as const));
    const big = run({ constCandidates: many }).find(x => x.id === 'split:AIMIM')!;
    expect([big.rows.length, big.more]).toEqual([10, 3]);
  });

  it('vote_split: cumulative spoilers hurting the same alliance count together', () => {
    // InsightsSection.tsx:91-100: s2 margin 50; AIMIM 20 + BSP 40 = 60 > 50, so both configs flag it.
    const two = [...splits, { spoiler: 'BSP', hurts: 'MGB', label: 'BSP split' }];
    const more = new Map(cc).set('s2', [cand('s2', 'JDU', 1000), cand('s2', 'RJD', 950), cand('s2', 'BSP', 40), cand('s2', 'AIMIM', 20)]);
    const secs = run({ voteSplits: two, constCandidates: more }).filter(s => s.id.startsWith('split:'));
    expect(secs.map(s => [s.titleParams!.label, s.titleParams!.count])).toEqual([['AIMIM split', 2], ['BSP split', 1]]);
  });

  it('classification: two-way, three-way and multi-cornered seats', () => {
    // InsightsSection.tsx:58-68: three-way only when not two-way.
    const rows = get('classification').rows;
    expect(rows.map(r => [r.id, r.value])).toEqual([['two_way', 2], ['three_way', 1], ['multi_cornered', 2]]);
    expect(rows[0].seatIds).toEqual(['s2', 's3']);
  });

  it('without vote splits only the numbers and the classification remain', () => {
    expect(run({ voteSplits: [] }).map(s => s.id)).toEqual(['vote_split', 'classification']);
  });

  it('is empty without full candidate data (legacy: needs a seat with 3+ candidates)', () => {
    expect(run({ constCandidates: new Map([['s4', cc.get('s4')!]]) })).toEqual([]);
    expect(run({ constCandidates: undefined })).toEqual([]);
  });
});
