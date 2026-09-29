import { avg } from './shared';
import type { SummaryContext, SummarySection } from './types';

/** ElectionSummary.tsx: Declared counts WON seats; average / median cover every seat with a leader (WON or LEADING). */
export function keyStats(ctx: SummaryContext): SummarySection | null {
  const margins = ctx.seats
    .filter(s => (s.status === 'WON' || s.status === 'LEADING') && s.margin != null)
    .map(s => s.margin as number)
    .sort((a, b) => a - b);
  if (margins.length === 0) return null;
  const mid = Math.floor(margins.length / 2);
  const median = margins.length % 2 === 0 ? Math.round((margins[mid - 1] + margins[mid]) / 2) : margins[mid];
  const declared = ctx.seats.filter(s => s.status === 'WON').length;
  const row = (id: string, labelKey: string, value: number | null, valueFormat: 'int' | 'compact') => ({ id, label: id, labelKey, value, valueFormat });
  return {
    id: 'key_stats', titleKey: '', layout: 'stats',
    rows: [
      row('declared', 'seats_declared', declared, 'int'),
      row('avg_margin', 'avg_margin', avg(margins.reduce((n, m) => n + m, 0), margins.length), 'compact'),
      row('median', 'median_margin', median, 'compact'),
    ],
  };
}
