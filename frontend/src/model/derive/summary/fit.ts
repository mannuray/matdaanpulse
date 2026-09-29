import type { SummarySection } from './types';

export interface SummaryFitOpts { headerH: number; rowH: number; gap: number; footerH: number }
export interface SummaryFitPlan { visible: { sectionId: string; rows: number }[]; hiddenRows: number; hiddenSections: number }

function place(sections: SummarySection[], available: number, o: SummaryFitOpts): SummaryFitPlan {
  const visible: SummaryFitPlan['visible'] = [];
  let used = 0;
  let hiddenRows = 0;
  let hiddenSections = 0;
  const step = o.rowH + o.gap;
  for (const s of sections) {
    if (s.rows.length === 0) { hiddenSections++; continue; }
    const lead = visible.length > 0 ? o.gap : 0;
    const room = available - used - lead - o.headerH;
    const fit = Math.min(s.rows.length, Math.floor((room + o.gap) / step));
    if (fit < 1) { hiddenSections++; hiddenRows += s.rows.length; continue; }
    // header + fit rows, each stacked with a gap between elements
    used += lead + o.headerH + fit * o.rowH + fit * o.gap;
    visible.push({ sectionId: s.id, rows: fit });
    hiddenRows += s.rows.length - fit;
  }
  return { visible, hiddenRows, hiddenSections };
}

/**
 * Which summary sections / how many rows fit in `available` px. Sections are placed in order; chart-only sections are
 * skipped (compact mode) and counted hidden; a section needs its header plus one row. When anything is hidden, space for the
 * "+N more" footer is reserved and the plan is recomputed.
 */
export function planSummaryFit(sections: SummarySection[], available: number, opts: SummaryFitOpts): SummaryFitPlan {
  const full = place(sections, available, opts);
  const chartOnly = sections.some(s => s.rows.length === 0);
  if (full.hiddenRows === 0 && full.hiddenSections === 0 && !chartOnly) return full;
  return place(sections, available - opts.footerH, opts);
}
