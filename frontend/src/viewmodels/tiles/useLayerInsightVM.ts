import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { deriveLayerInsight, type InsightChip, type LayerInsight } from '../../model/derive/layerInsights';
import type { LayerId } from '../../model/types/dashboard';
import type { MarginTrendPoint, PartySwitchEntry } from '../../model/types';

export type { InsightChip, LayerInsight };

export interface NetSwingRow { id: string; name: string; color: string; gained: number; lost: number }

export interface LayerInsightVM {
  layer: LayerId;
  insight: LayerInsight | null;
  lockedChipId: string | null;
  netSwing: NetSwingRow[];
  marginTrend: MarginTrendPoint[];
  partySwitches: PartySwitchEntry[];
  onFocus(): void;
  onHoverChip(c: InsightChip | null): void;
  onLockChip(c: InsightChip): void;
}

export function useLayerInsightVM(): LayerInsightVM {
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
  }), [state.layer, src, alliances]);

  const netSwing = useMemo((): NetSwingRow[] => {
    const al = new Map<string, { id: string; name: string; color: string }>();
    alliances.forEach(a => a.parties.forEach(p => al.set(p, a)));
    const rows = new Map<string, NetSwingRow>();
    const row = (party: string) => {
      const a = al.get(party);
      const id = a?.id ?? party;
      if (!rows.has(id)) rows.set(id, { id, name: a?.name ?? party, color: a?.color ?? src.data.partyColorMap.get(party) ?? '#8A93A6', gained: 0, lost: 0 });
      return rows.get(id)!;
    };
    for (const e of src.swing.values()) if (e.flipped) { row(e.currentParty).gained++; row(e.prevParty).lost++; }
    return [...rows.values()].sort((a, b) => (b.gained - b.lost) - (a.gained - a.lost));
  }, [src.swing, alliances, src.data.partyColorMap]);

  const highlightOf = (c: InsightChip) => ({ parties: [], seats: c.seatIds });
  return {
    layer: state.layer,
    insight,
    lockedChipId: state.locked?.chipId.startsWith('chip:') ? state.locked.chipId.slice(5) : null,
    netSwing,
    marginTrend: src.marginTrend,
    partySwitches: src.partySwitches,
    onFocus: () => dispatch({ type: 'focus', tile: 'insight' }),
    onHoverChip: c => dispatch({ type: 'hover', highlight: c ? highlightOf(c) : null }),
    onLockChip: c => dispatch({ type: 'toggleLock', chipId: `chip:${c.id}`, highlight: highlightOf(c) }),
  };
}
