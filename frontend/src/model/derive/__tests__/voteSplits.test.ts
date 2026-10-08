import { describe, it, expect } from 'vitest';
import { isThreeWay, seatSplits } from '../voteSplits';

const c = (party_id: string, votes: number) => ({ party_id, votes });
const alliance = new Map([['RJD', 'MGB'], ['INC', 'MGB'], ['JDU', 'NDA'], ['BJP', 'NDA']]);
const allianceOf = (p: string) => alliance.get(p.toUpperCase()) ?? null;
const splits = [{ spoiler: 'AIMIM', hurts: 'MGB', label: 'AIMIM split' }, { spoiler: 'BSP', hurts: 'mgb', label: 'BSP split' }];

describe('seatSplits: the configured splits that cost a seat (one rule for the map, chips and summary)', () => {
  it('a spoiler whose votes exceed the margin, when the runner-up is on the side it hurts', () => {
    expect(seatSplits([c('JDU', 1000), c('RJD', 900), c('AIMIM', 150)], splits, allianceOf)).toEqual(['AIMIM']);
    expect(seatSplits([c('JDU', 1000), c('RJD', 900), c('AIMIM', 50)], splits, allianceOf)).toEqual([]);
  });
  it('never the winner or the runner-up; the side can be the runner-up\'s party; matching ignores case', () => {
    expect(seatSplits([c('AIMIM', 1000), c('RJD', 900), c('BJP', 200)], splits, allianceOf)).toEqual([]);
    expect(seatSplits([c('JDU', 1000), c('RJD', 900), c('aimim', 150)], [{ spoiler: 'AIMIM', hurts: 'rjd', label: 'x' }], allianceOf)).toEqual(['AIMIM']);
  });
  it('cumulative: spoilers hurting the same side count together', () => {
    expect(seatSplits([c('JDU', 1000), c('RJD', 900), c('AIMIM', 60), c('BSP', 60)], splits, allianceOf)).toEqual(['AIMIM', 'BSP']);
  });
  it('a runner-up on another side, or fewer than three candidates: none', () => {
    expect(seatSplits([c('RJD', 1000), c('JDU', 900), c('AIMIM', 500)], splits, allianceOf)).toEqual([]);
    expect(seatSplits([c('JDU', 1000), c('RJD', 900)], splits, allianceOf)).toEqual([]);
  });
});

describe('isThreeWay', () => {
  it('top two under 80% and the third at least 15%', () => {
    expect(isThreeWay([c('A', 40), c('B', 35), c('C', 20), c('D', 5)])).toBe(true);
    expect(isThreeWay([c('A', 45), c('B', 36), c('C', 16), c('D', 3)])).toBe(false);   // top two 81%
    expect(isThreeWay([c('A', 40), c('B', 35), c('C', 10), c('D', 15)])).toBe(true);   // sorted: the third is D at 15%
    expect(isThreeWay([c('A', 40), c('B', 35), c('C', 14), c('D', 11)])).toBe(false);  // third under 15%
    expect(isThreeWay([c('A', 1), c('B', 1)])).toBe(false);
  });
});
