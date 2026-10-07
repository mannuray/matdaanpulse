import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { intentFor } from '../store/hoverIntent';
import { countingLive } from '../../model/derive/mapFill';
import { deriveLayerInsight, type InsightChip, type LayerInsight } from '../../model/derive/layerInsights';
import type { LayerId } from '../../model/types/dashboard';

export type { InsightChip, LayerInsight };

export interface LayerInsightVM {
  layer: LayerId;
  insight: LayerInsight | null;
  lockedChipId: string | null;
  onFocus(): void;
  onHoverChip(c: InsightChip | null): void;
  onLockChip(c: InsightChip): void;
}

export function useLayerInsightVM(): LayerInsightVM {
  const { t } = useTranslation();
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const alliances = useMemo(() => src.data.manifestData?.alliances ?? [], [src.data.manifestData]);
  const insight = useMemo(() => deriveLayerInsight(state.layer, {
    electionType: src.election.type,
    seats: src.data.mapRegions,
    alliances,
    partyColor: src.data.partyColorMap,
    swing: src.swing,
    prevYear: src.prevYear,
    dominance: src.dominance,
    incumbency: src.incumbency,
    voteSplits: src.data.manifestData?.vote_splits,
    constCandidates: src.data.constCandidates,
    threeWaySeats: src.data.spoilerData.threeWaySeats,
    live: countingLive(src.election.status === 'Live' ? src.liveAnalysis?.seats : undefined),
  }), [state.layer, src, alliances]);

  const locked = state.locked;
  useEffect(() => {
    if (!locked?.chipId.startsWith('chip:') || !insight) return;
    const c = insight.chips.find(x => `chip:${x.id}` === locked.chipId);
    if (!c) return;
    const cur = locked.highlight.seats;
    if (c.seatIds.length !== cur.length || c.seatIds.some((x, i) => x !== cur[i])) dispatch({ type: 'refreshLock', chipId: locked.chipId, highlight: { parties: [], seats: c.seatIds } });
  }, [insight, locked, dispatch]);

  const highlightOf = (c: InsightChip) => ({ parties: [], seats: c.seatIds });
  return {
    layer: state.layer,
    insight,
    lockedChipId: state.locked?.chipId.startsWith('chip:') ? state.locked.chipId.slice(5) : null,
    onFocus: () => dispatch({ type: 'focus', tile: 'insight' }),
    onHoverChip: c => intentFor(dispatch)(c ? highlightOf(c) : null),
    onLockChip: c => dispatch({ type: 'toggleLock', chipId: `chip:${c.id}`, highlight: highlightOf(c), label: c.labelKey ? t(c.labelKey) : c.label }),
  };
}
