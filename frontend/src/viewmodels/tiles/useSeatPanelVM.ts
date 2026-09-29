import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useApi } from '../data/useApi';
import { getConstituencyAnalysis } from '../../model/api/election.service';
import { displayNameFromConstId } from '../../model/geo/regionMatching';

export interface SeatPanelVM {
  seatId: string;
  name: string;
  candidates: { name: string; partyId: string; color: string; votes: number; status: string }[];
  margin: number | null;
  history: { classification: string; dominantParty: string | null } | null;
  briefing: string | null;
  fullPageHref: string;
  tracked: boolean;
  onToggleTrack(): void;
  onClose(): void;
}

export function useSeatPanelVM(): SeatPanelVM | null {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const id = state.selectedSeat;
  // Hook runs every render (rules of hooks); it fetches only when a seat is selected.
  const { data: analysis } = useApi(() => (id ? getConstituencyAnalysis(src.election.id, id) : Promise.resolve(null)), [src.election.id, id]);
  if (!id) return null;
  const dom = src.dominance.get(id);
  const rows = src.data.constCandidates.get(id) ?? [];
  const winner = src.data.currentWinnerMap.get(id);
  const name = displayNameFromConstId(id);
  const tracked = src.watchlist.some(w => w.const_id === id);
  return {
    seatId: id,
    name,
    candidates: rows.map(r => ({ name: r.candidate_name, partyId: r.party_id, color: src.data.partyColorMap.get(r.party_id) ?? '#8A93A6', votes: r.votes, status: r.status })),
    margin: winner ? Number(winner.margin) || 0 : null,
    history: dom ? { classification: dom.classification, dominantParty: dom.dominantParty ?? null } : null,
    briefing: (analysis as { ai_briefing?: string | null } | null)?.ai_briefing ?? null,
    fullPageHref: `/election/${src.election.id}/constituency/${id}`,
    tracked,
    onToggleTrack: () => (tracked ? src.removeWatch(id) : src.addWatch(id, name)),
    onClose: () => dispatch({ type: 'selectSeat', seat: null }),
  };
}
