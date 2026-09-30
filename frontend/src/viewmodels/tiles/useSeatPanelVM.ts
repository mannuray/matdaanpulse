import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { displayNameFromConstId } from '../../model/geo/regionMatching';

export interface SeatPanelVM {
  seatId: string;
  name: string;
  candidates: { name: string; partyId: string; color: string; votes: number; status: string }[];
  margin: number | null;
  history: { classification: string; dominantParty: string | null } | null;
  fullPageHref: string;
  tracked: boolean;
  onToggleTrack(): void;
  onClose(): void;
}

export function useSeatPanelVM(): SeatPanelVM | null {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const id = state.selectedSeat;
  if (!id) return null;
  const dom = src.dominance.get(id);
  const rows = src.data.constCandidates.get(id) ?? [];
  const winner = src.data.currentWinnerMap.get(id);
  const name = displayNameFromConstId(id);
  const tracked = src.watchlist.some(w => w.const_id === id);
  return {
    seatId: id,
    name,
    candidates: rows.map(r => ({ name: r.candidate_name, partyId: r.party_id, color: src.data.partyColorMap.get(r.party_id) ?? 'var(--color-fallback)', votes: r.votes, status: r.status })),
    margin: winner ? Number(winner.margin) || 0 : null,
    history: dom ? { classification: dom.classification, dominantParty: dom.dominantParty ?? null } : null,
    fullPageHref: `/election/${src.election.id}/constituency/${id}`,
    tracked,
    onToggleTrack: () => (tracked ? src.removeWatch(id) : src.addWatch(id, name)),
    onClose: () => dispatch({ type: 'selectSeat', seat: null }),
  };
}
