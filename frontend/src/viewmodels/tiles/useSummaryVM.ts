import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { deriveLayerSummary, type LayerSummary, type SummaryRow } from '../../model/derive/summary';
import type { LayerId } from '../../model/types/dashboard';

export type { ChartSeries, ChartSpec, LayerSummary, SummaryRow, SummarySection } from '../../model/derive/summary';

export interface SummaryVM {
  layer: LayerId;
  summary: LayerSummary;
  /** `<sectionId>:<rowId>` of the locked row (views compare against `${section.id}:${row.id}`), or null. */
  lockedRowId: string | null;
  onFocus(): void;
  onHoverRow(r: SummaryRow | null): void;
  onLockRow(r: SummaryRow): void;
  onSelectSeat(id: string): void;
}

const PREFIX = 'sum:';

export function useSummaryVM(): SummaryVM {
  const { t } = useTranslation();
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const alliances = useMemo(() => src.data.manifestData?.alliances ?? [], [src.data.manifestData]);
  const summary = useMemo(() => deriveLayerSummary(state.layer, {
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
    votePct: src.votePct,
    parties: src.data.mapPartyList,
    marginTrend: src.marginTrend,
    partyTrend: src.partyTrend,
    partySwitches: src.partySwitches,
  }), [state.layer, src, alliances]);

  const highlightOf = (r: SummaryRow) => ({ parties: r.partyIds ?? [], seats: r.seatIds ?? [] });
  return {
    layer: state.layer,
    summary,
    lockedRowId: state.locked?.chipId.startsWith(PREFIX) ? state.locked.chipId.slice(PREFIX.length) : null,
    onFocus: () => dispatch({ type: 'focus', tile: 'insight' }),
    onHoverRow: r => dispatch({ type: 'hover', highlight: r ? highlightOf(r) : null }),
    onLockRow: r => {
      const section = summary.sections.find(s => s.rows.includes(r));
      dispatch({ type: 'toggleLock', chipId: `${PREFIX}${section?.id ?? ''}:${r.id}`, highlight: highlightOf(r), label: r.labelKey ? t(r.labelKey) : r.label });
    },
    onSelectSeat: id => dispatch({ type: 'selectSeat', seat: id }),
  };
}
