import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useLocalStorage } from '../data/useLocalStorage';
import { collectLeaderEntries, deriveLeaderCards, type CustomWatch, type LeaderCard } from '../../model/derive/leaders';

export type { LeaderCard };

export interface LeadersVM {
  cards: LeaderCard[];
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
  // Same storage key as the baseline WatchlistPanel, so users keep their watchlist.
  const [custom, setCustom] = useLocalStorage<CustomWatch[]>(`watchlist_${src.election.id}`, []);
  const cards = useMemo(
    () => deriveLeaderCards(collectLeaderEntries(src.data.manifestData, custom || []), src.data.currentWinnerMap),
    [src.data.manifestData, custom, src.data.currentWinnerMap],
  );
  const seatOptions = useMemo(() => src.data.mapRegions.map(r => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name)), [src.data.mapRegions]);
  return {
    cards,
    partyColor: src.data.partyColorMap,
    seatOptions,
    onFocus: () => dispatch({ type: 'focus', tile: 'leaders' }),
    onSelectSeat: id => dispatch({ type: 'selectSeat', seat: id }),
    onHoverSeat: id => dispatch({ type: 'hover', highlight: id ? { parties: [], seats: [id] } : null }),
    onAddCustom: constId => setCustom(prev => (prev || []).some(w => w.const_id === constId) ? prev || [] : [...(prev || []), { const_id: constId, label: seatOptions.find(s => s.id === constId)?.name ?? constId }]),
    onRemoveCustom: constId => setCustom(prev => (prev || []).filter(w => w.const_id !== constId)),
  };
}
