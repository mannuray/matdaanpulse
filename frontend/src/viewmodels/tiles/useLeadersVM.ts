import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { intentFor } from '../store/hoverIntent';
import { collectLeaderEntries, deriveLeaderCards, type LeaderCard } from '../../model/derive/leaders';

export type { LeaderCard };

export interface LeadersVM {
  /** Manifest leaders only, in manifest order. */
  leaders: LeaderCard[];
  /** The user's own tracked seats only. */
  watchlist: LeaderCard[];
  partyColor: Map<string, string>;
  seatOptions: { id: string; name: string }[];
  onFocus(): void;
  onSelectSeat(id: string): void;
  onHoverSeat(id: string | null): void;
  onAddCustom(constId: string): void;
  onRemoveCustom(constId: string): void;
}

export function useLeadersVM(): LeadersVM {
  const src = useSources();
  const { dispatch } = useDashboardStore();
  const { manifestData, currentWinnerMap, mapRegions } = src.data;
  const leaders = useMemo(
    () => deriveLeaderCards(collectLeaderEntries(manifestData, []), currentWinnerMap),
    [manifestData, currentWinnerMap],
  );
  const watchlist = useMemo(
    () => deriveLeaderCards(collectLeaderEntries(null, src.watchlist), currentWinnerMap),
    [src.watchlist, currentWinnerMap],
  );
  const seatOptions = useMemo(() => mapRegions.map(r => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name)), [mapRegions]);
  return {
    leaders,
    watchlist,
    partyColor: src.data.partyColorMap,
    seatOptions,
    onFocus: () => dispatch({ type: 'focus', tile: 'leaders' }),
    onSelectSeat: id => dispatch({ type: 'selectSeat', seat: id }),
    onHoverSeat: id => intentFor(dispatch)(id ? { parties: [], seats: [id] } : null),
    onAddCustom: constId => src.addWatch(constId, seatOptions.find(s => s.id === constId)?.name ?? constId),
    onRemoveCustom: src.removeWatch,
  };
}
