import type { SummarySection } from './types';

/** `statsH`: height of a stats-layout section's number block (defaults to rowH). */
export interface SummaryFitOpts { headerH: number; rowH: number; gap: number; statsH?: number }
export interface SummaryFitPlan { visible: { sectionId: string; rows: number }[] }

/**
 * Which summary sections / how many rows fit in `available` px (the mobile rail preview). Sections are placed in order;
 * a section without rows is skipped; a section needs its header plus one row; a stats section is all-or-nothing.
 */
export function planSummaryFit(sections: SummarySection[], available: number, o: SummaryFitOpts): SummaryFitPlan {
  const visible: SummaryFitPlan['visible'] = [];
  let used = 0;
  const step = o.rowH + o.gap;
  for (const s of sections) {
    if (s.rows.length === 0) continue;
    const lead = visible.length > 0 ? o.gap : 0;
    // An untitled section (titleKey '') has no header line.
    const head = s.titleKey ? o.headerH + o.gap : 0;
    if (s.layout === 'stats') {
      const need = lead + head + (o.statsH ?? o.rowH);
      if (used + need > available) continue;
      used += need;
      visible.push({ sectionId: s.id, rows: s.rows.length });
      continue;
    }
    const room = available - used - lead - head;
    const fit = Math.min(s.rows.length, Math.floor((room + o.gap) / step));
    if (fit < 1) continue;
    used += lead + head + fit * step - o.gap;
    visible.push({ sectionId: s.id, rows: fit });
  }
  return { visible };
}
