import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { cand, makeCtx } from './fixtures';

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
const run = (over = {}) => deriveLayerSummary('insights', makeCtx({ constCandidates: cc, voteSplits: splits, ...over })).sections;
const get = (id: string, over = {}) => run(over).find(s => s.id === id)!;

describe('insights summary', () => {
  it('sections in the binding order', () => {
    expect(run().map(s => s.id)).toEqual(['vote_split', 'classification']);
  });

  it('vote_split: seats where the spoiler outpolled the margin and the runner-up is in the hurt alliance', () => {
    // InsightsSection.tsx:75-100: matches the runner-up alliance, spoiler votes 500 > margin 100.
    const rows = get('vote_split').rows;
    expect(rows.map(r => [r.id, r.label, r.sub, r.value, r.extra?.map(e => e.value)])).toEqual([
      ['split:AIMIM', 'AIMIM split', 'MGB', 1, undefined],
      ['split:AIMIM:s1', 's1', 'NDA', 100, [500]],
    ]);
    expect(rows[0]).toMatchObject({ seatIds: ['s1'], partyIds: ['AIMIM'], color: '#2BB673' });
  });

  it('vote_split: cumulative spoilers hurting the same alliance count together', () => {
    // InsightsSection.tsx:91-100: s2 margin 50; AIMIM 20 + BSP 40 = 60 > 50, so both configs flag it.
    const two = [...splits, { spoiler: 'BSP', hurts: 'MGB', label: 'BSP split' }];
    const more = new Map(cc).set('s2', [cand('s2', 'JDU', 1000), cand('s2', 'RJD', 950), cand('s2', 'BSP', 40), cand('s2', 'AIMIM', 20)]);
    const rows = get('vote_split', { voteSplits: two, constCandidates: more }).rows.filter(r => r.id.split(':').length === 2);
    expect(rows.map(r => [r.label, r.value])).toEqual([['AIMIM split', 2], ['BSP split', 1]]);
  });

  it('classification: analysed, two-way, three-way, multi-cornered and spoiler-affected seats', () => {
    // InsightsSection.tsx:58-68: analysed = seats with 3+ candidates (s1, s2, s3); three-way only when not two-way.
    const rows = get('classification').rows;
    expect(rows.map(r => [r.id, r.value])).toEqual([['analyzed', 3], ['two_way', 2], ['three_way', 1], ['multi_cornered', 2], ['spoiler_affected', 1]]);
    expect(rows[1].seatIds).toEqual(['s2', 's3']);
    expect(rows[4].seatIds).toEqual(['s1']);
  });

  it('without vote splits only the classification remains', () => {
    expect(run({ voteSplits: [] }).map(s => s.id)).toEqual(['classification']);
  });

  it('is empty without full candidate data (legacy: needs a seat with 3+ candidates)', () => {
    expect(run({ constCandidates: new Map([['s4', cc.get('s4')!]]) })).toEqual([]);
    expect(run({ constCandidates: undefined })).toEqual([]);
  });
});
