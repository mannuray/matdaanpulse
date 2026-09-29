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
  it('untitled sections have no header, and stats sections are all-or-nothing blocks of statsH', () => {
    const stats: SummarySection = { id: 'k', titleKey: '', layout: 'stats', rows: [row(1), row(2), row(3)] };
    const o = { ...O, statsH: 52 };
    // Untitled stats: 52. Then A(2) = 4 + 22 + 4 + 2*32 - 4 = 90 -> 142 total (all fits, no footer).
    expect(planSummaryFit([stats, sec('a', 2)], 142, o)).toEqual({ visible: [{ sectionId: 'k', rows: 3 }, { sectionId: 'a', rows: 2 }], hiddenRows: 0, hiddenSections: 0 });
    // 51px: the block does not fit -> hidden (3 rows), and nothing else does either.
    expect(planSummaryFit([stats], 51, o)).toEqual({ visible: [], hiddenRows: 3, hiddenSections: 1 });
    // Titled stats: header 22 + gap 4 + 52 = 78.
    const titled: SummarySection = { ...stats, id: 't', titleKey: 't' };
    expect(planSummaryFit([titled], 78, o).visible).toEqual([{ sectionId: 't', rows: 3 }]);
    expect(planSummaryFit([titled], 77, o).visible).toEqual([]);
  });

  it('counts rows the model already cut (`more`) in the hidden rows and always reserves the footer', () => {
    const cut: SummarySection = { ...sec('a', 2), more: 3 };
    expect(planSummaryFit([cut], 500, O)).toEqual({ visible: [{ sectionId: 'a', rows: 2 }], hiddenRows: 3, hiddenSections: 0 });
  });

  it('fits rows exactly: header + n rows with gaps, no off-by-a-gap', () => {
    // A(5) needs 22 + 5*32 = 182; with a footer reserved, 3 rows = 22 + 96 = 118 <= 130 but 4 rows = 150 > 130.
    expect(planSummaryFit([sec('a', 5)], 150, O).visible).toEqual([{ sectionId: 'a', rows: 3 }]);
    // 127px available -> 107 after the footer: 3 rows need 118, so only 2 rows fit.
    expect(planSummaryFit([sec('a', 5)], 127, O).visible).toEqual([{ sectionId: 'a', rows: 2 }]);
  });
});
