import { describe, it, expect } from 'vitest';
import { planSummaryFit } from '../fit';
import type { SummarySection } from '../types';

const row = (i: number) => ({ id: `r${i}`, label: `R${i}`, value: i, valueFormat: 'int' as const });
const sec = (id: string, n: number): SummarySection => ({ id, titleKey: id, rows: Array.from({ length: n }, (_, i) => row(i)) });
const O = { headerH: 22, rowH: 28, gap: 4 };
// Section with n rows = 22 + n*(28+4); sections are separated by one gap.

describe('planSummaryFit (mobile rail preview)', () => {
  it('shows everything when it all fits', () => {
    // A(2)=86, B(1)=54, +gap 4 => 144
    expect(planSummaryFit([sec('a', 2), sec('b', 1)], 144, O)).toEqual({ visible: [{ sectionId: 'a', rows: 2 }, { sectionId: 'b', rows: 1 }] });
  });
  it('truncates rows to what fits, with no off-by-a-gap', () => {
    // header 22 + gap 4 = 26; n rows = 32n - 4 -> 2 rows = 86 (<= 120), 3 rows = 118 (<= 120), 4 rows = 150
    expect(planSummaryFit([sec('a', 5)], 120, O).visible).toEqual([{ sectionId: 'a', rows: 3 }]);
    expect(planSummaryFit([sec('a', 5)], 117, O).visible).toEqual([{ sectionId: 'a', rows: 2 }]);
  });
  it('treats a section with a chart and plain rows as a normal row section', () => {
    const both: SummarySection = { ...sec('c', 2), chart: { type: 'bar', series: [] } };
    expect(planSummaryFit([both], 500, O).visible).toEqual([{ sectionId: 'c', rows: 2 }]);
  });
  it('drops later sections that cannot show header plus one row', () => {
    // A(2)=86 fits in 130; B needs 4+22+4+28 = 58 -> 144 > 130
    expect(planSummaryFit([sec('a', 2), sec('b', 3)], 130, O).visible).toEqual([{ sectionId: 'a', rows: 2 }]);
  });
  it('skips chart-only sections', () => {
    const chart: SummarySection = { id: 'c', titleKey: 'c', rows: [], chart: { type: 'bar', series: [] } };
    expect(planSummaryFit([chart, sec('a', 1)], 500, O).visible).toEqual([{ sectionId: 'a', rows: 1 }]);
  });
  it('shows nothing when not even one section fits, and handles empty input', () => {
    expect(planSummaryFit([sec('a', 3)], 40, O).visible).toEqual([]);
    expect(planSummaryFit([], 300, O).visible).toEqual([]);
  });
  it('untitled sections have no header, and stats sections are all-or-nothing blocks of statsH', () => {
    const stats: SummarySection = { id: 'k', titleKey: '', layout: 'stats', rows: [row(1), row(2), row(3)] };
    const o = { ...O, statsH: 52 };
    // Untitled stats: 52. Then A(2) = 4 + 22 + 4 + 2*32 - 4 = 90 -> 142 total.
    expect(planSummaryFit([stats, sec('a', 2)], 142, o).visible).toEqual([{ sectionId: 'k', rows: 3 }, { sectionId: 'a', rows: 2 }]);
    expect(planSummaryFit([stats], 51, o).visible).toEqual([]);
    // Titled stats: header 22 + gap 4 + 52 = 78.
    const titled: SummarySection = { ...stats, id: 't', titleKey: 't' };
    expect(planSummaryFit([titled], 78, o).visible).toEqual([{ sectionId: 't', rows: 3 }]);
    expect(planSummaryFit([titled], 77, o).visible).toEqual([]);
  });
});
