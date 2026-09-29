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

export type { ChartSeries, ChartSpec, LayerSummary, SummaryCell, SummaryContext, SummaryRow, SummarySection, ValueFormat } from './types';

const SECTIONS: Record<LayerId, (ctx: SummaryContext) => SummarySection[]> = {
  overview: overviewSummary,
  battle: battleSummary,
  swing: swingSummary,
  history: historySummary,
  demographics: demographicsSummary,
  insights: insightsSummary,
  states: statesSummary,
};

/** The election summary shown for the active map layer. A layer without data returns no sections (the key stats need at least one seat with a leader). */
export function deriveLayerSummary(layer: LayerId, ctx: SummaryContext): LayerSummary {
  const sections = SECTIONS[layer](ctx);
  // The legacy card showed Declared / Avg margin / Median above every layer's sections.
  const stats = keyStats(ctx);
  return { layer, sections: stats ? [stats, ...sections] : sections };
}
