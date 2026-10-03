import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useApi } from '../data/useApi';
import { getConstituency, getConstituencyAnalysis, ElectionService } from '../../model/api/election.service';
import { displayNameFromConstId } from '../../model/geo/regionMatching';
import { buildSeatView, liveChipState, seatHistory, seatNotes, type LiveChipState, type SeatView, type SeatNote } from '../../model/derive/seatView';
import type { PartyMeta } from '../../model/derive/partyMeta';
import type { SeatHistoryEntry } from '../../model/types';

export interface SeatDialogVM {
  seatId: string; name: string; constNo: number | null; type: 'GEN' | 'SC' | 'ST' | null; place: string | null;
  live: LiveChipState;
  electors: number | null; turnout: number | null; phase: number | null;
  view: SeatView; history: SeatHistoryEntry[]; notes: SeatNote[];
  partyMeta: Map<string, PartyMeta>;
  detailState: 'loading' | 'ready' | 'error';
  fullPageHref: string; tracked: boolean;
  onToggleTrack(): void; onClose(): void; onOpenParty(id: string): void; personHref(id: string): string;
}

const DIALOG_ROWS = 5;

export function useSeatDialogVM(): SeatDialogVM | null {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const id = state.selectedSeat;
  const eid = src.election.id;
  // Refetch while open on every new live version, so the counting round follows the snapshot (CDN-cached ~60 s).
  const version = src.election.status === 'Live' ? src.data.liveVersion : null;
  const detail = useApi(() => (id ? getConstituency(eid, id) : Promise.resolve(null)), [eid, id, version], { key: id ? `${ElectionService.getConstituencyCacheKey(eid, id)}_v${version ?? ''}` : undefined });
  const analysis = useApi(() => (id ? getConstituencyAnalysis(eid, id).catch(() => null) : Promise.resolve(null)), [eid, id], { key: id ? `${ElectionService.getConstituencyCacheKey(eid, id)}_analysis` : undefined });
  // useApi keeps the previous seat's data while the next one loads: only use data that belongs to the selected seat.
  const d = detail.data && detail.data.id === id ? detail.data : null;
  const fullAnalysis = analysis.data && analysis.data.const_id === id ? analysis.data : null;
  const rows = id ? src.data.constCandidates.get(id) : undefined;
  const view = useMemo(
    () => buildSeatView(rows ?? [], { partyMeta: src.partyMeta, partyColor: src.data.partyColorMap, detail: d?.candidates ?? null, limit: DIALOG_ROWS }),
    [rows, src.partyMeta, src.data.partyColorMap, d],
  );
  if (!id) return null;
  const tracked = src.watchlist.some(w => w.const_id === id);
  const name = d?.name ?? displayNameFromConstId(id);
  const live = liveChipState(src.election.status, rows ?? [], d, src.data.seats[id] ?? null);
  return {
    seatId: id,
    name,
    constNo: d?.const_no ?? null,
    type: d?.type ?? rows?.[0]?.const_type ?? null,
    place: [d?.district?.name, d?.state?.name].filter(Boolean).join(' · ') || null,
    live,
    electors: d?.total_electors ?? null,
    turnout: d?.voter_turnout != null ? Number(d.voter_turnout) : null,
    phase: d?.phase ?? null,
    view,
    history: seatHistory(fullAnalysis, src.election.year),
    notes: seatNotes(view, fullAnalysis),
    partyMeta: src.partyMeta,
    detailState: detail.error ? 'error' : d ? 'ready' : 'loading',
    fullPageHref: `/election/${eid}/constituency/${id}`,
    tracked,
    onToggleTrack: () => (tracked ? src.removeWatch(id) : src.addWatch(id, name)),
    onClose: () => dispatch({ type: 'selectSeat', seat: null }),
    onOpenParty: pid => dispatch({ type: 'selectParty', party: pid }),
    personHref: pid => `/person/${pid}`,
  };
}
