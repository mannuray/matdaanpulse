import { describe, it, expect } from 'vitest';
import { planSummaryFit } from '../fit';
import type { SummarySection } from '../types';

const row = (i: number) => ({ id: `r${i}`, label: `R${i}`, value: i, valueFormat: 'int' as const });
const sec = (id: string, n: number): SummarySection => ({ id, titleKey: id, rows: Array.from({ length: n }, (_, i) => row(i)) });
const O = { headerH: 22, rowH: 28, gap: 4, footerH: 20 };
// Section with n rows = 22 + n*(28+4); sections are separated by one gap.

describe('planSummaryFit', () => {
  it('shows everything without a footer when it all fits', () => {
    // A(2)=86, B(1)=54, +gap 4 => 144
    expect(planSummaryFit([sec('a', 2), sec('b', 1)], 144, O)).toEqual({ visible: [{ sectionId: 'a', rows: 2 }, { sectionId: 'b', rows: 1 }], hiddenRows: 0, hiddenSections: 0 });
  });
  it('reserves the footer and truncates rows when not everything fits', () => {
    // A(5) needs 182; with 150 avail: 150-20=130 => 22 + n*32 <= 130 => n=3
    expect(planSummaryFit([sec('a', 5)], 150, O)).toEqual({ visible: [{ sectionId: 'a', rows: 3 }], hiddenRows: 2, hiddenSections: 0 });
  });
  it('hides later sections that cannot show header plus one row', () => {
    // avail 150-20=130: A(2)=86 fits; B needs 4+22+32=58 -> 144 > 130
    expect(planSummaryFit([sec('a', 2), sec('b', 3)], 150, O)).toEqual({ visible: [{ sectionId: 'a', rows: 2 }], hiddenRows: 3, hiddenSections: 1 });
  });
  it('skips chart-only sections and counts them hidden', () => {
    const chart: SummarySection = { id: 'c', titleKey: 'c', rows: [], chart: { type: 'bar', series: [] } };
    expect(planSummaryFit([chart, sec('a', 1)], 500, O)).toEqual({ visible: [{ sectionId: 'a', rows: 1 }], hiddenRows: 0, hiddenSections: 1 });
  });
  it('shows nothing when not even one section fits', () => {
    expect(planSummaryFit([sec('a', 3)], 40, O)).toEqual({ visible: [], hiddenRows: 3, hiddenSections: 1 });
  });
  it('handles empty input', () => {
    expect(planSummaryFit([], 300, O)).toEqual({ visible: [], hiddenRows: 0, hiddenSections: 0 });
  });
});
