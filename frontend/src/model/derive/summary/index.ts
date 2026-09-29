import type { LayerId } from '../../types/dashboard';
import { battleSummary } from './battle';
import { demographicsSummary } from './demographics';
import { historySummary } from './history';
import { insightsSummary } from './insights';
import { overviewSummary } from './overview';
import { statesSummary } from './states';
import { swingSummary } from './swing';
import type { LayerSummary, SummaryContext, SummarySection } from './types';

export type { ChartSeries, ChartSpec, LayerSummary, SummaryContext, SummaryRow, SummarySection } from './types';

const SECTIONS: Record<LayerId, (ctx: SummaryContext) => SummarySection[]> = {
  overview: overviewSummary,
  battle: battleSummary,
  swing: swingSummary,
  history: historySummary,
  demographics: demographicsSummary,
  insights: insightsSummary,
  states: statesSummary,
};

/** The election summary shown for the active map layer. A layer without data returns no sections. */
export function deriveLayerSummary(layer: LayerId, ctx: SummaryContext): LayerSummary {
  return { layer, sections: SECTIONS[layer](ctx) };
}
