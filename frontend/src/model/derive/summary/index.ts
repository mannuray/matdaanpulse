import type { LayerId } from '../../types/dashboard';
import { battleSummary } from './battle';
import { demographicsSummary } from './demographics';
import { historySummary } from './history';
import { insightsSummary } from './insights';
import { overviewSummary } from './overview';
import { keyStats } from './keyStats';
import { statesSummary } from './states';
import { swingSummary } from './swing';
import type { LayerSummary, SummaryContext, SummarySection } from './types';

export type { ChartAnnotation, ChartSeries, ChartSpec, ChartValueFormat, LayerSummary, SummaryCell, SummaryContext, SummaryRow, SummarySection, ValueFormat } from './types';

const SECTIONS: Record<LayerId, (ctx: SummaryContext) => SummarySection[]> = {
  overview: overviewSummary,
  battle: battleSummary,
  swing: swingSummary,
  history: historySummary,
  demographics: demographicsSummary,
  insights: insightsSummary,
  states: statesSummary,
};

/**
 * A row's seatIds are what the map highlights, so they may only name seats of this election. History rows can name seats of
 * earlier elections (party switches, old incumbents); those ids are dropped, and a row left with none is plain text.
 */
function onlyKnownSeats(sections: SummarySection[], ctx: SummaryContext): SummarySection[] {
  const known = new Set(ctx.seats.map(s => s.id));
  return sections.map(sec => sec.rows.some(r => r.seatIds?.some(id => !known.has(id)))
    ? { ...sec, rows: sec.rows.map(r => (r.seatIds?.some(id => !known.has(id)) ? { ...r, seatIds: r.seatIds.filter(id => known.has(id)) } : r)) }
    : sec);
}

/** The election summary shown for the active map layer. A layer without data returns no sections (the key stats need at least one seat with a leader). */
export function deriveLayerSummary(layer: LayerId, ctx: SummaryContext): LayerSummary {
  const sections = onlyKnownSeats(SECTIONS[layer](ctx), ctx);
  // The legacy card showed Declared / Avg margin / Median above every layer's sections.
  const stats = keyStats(ctx);
  return { layer, sections: stats ? [stats, ...sections] : sections };
}
