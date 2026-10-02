import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useApi } from '../data/useApi';
import { getConstituency, getConstituencyAnalysis, ElectionService } from '../../model/api/election.service';
import { displayNameFromConstId } from '../../model/geo/regionMatching';
import { buildSeatView, seatHistory, seatNotes, type SeatView, type SeatNote } from '../../model/derive/seatView';
import type { PartyMeta } from '../../model/derive/partyMeta';
import type { SeatHistoryEntry } from '../../model/types';

export interface SeatDialogVM {
  seatId: string; name: string; constNo: number | null; type: 'GEN' | 'SC' | 'ST' | null; place: string | null;
  live: { kind: 'counting'; round: { current: number; total: number } | null } | { kind: 'declared' } | null;
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
  const rows = id ? src.data.constCandidates.get(id) : undefined;
  const view = useMemo(
    () => buildSeatView(rows ?? [], { partyMeta: src.partyMeta, partyColor: src.data.partyColorMap, detail: detail.data?.candidates ?? null, limit: DIALOG_ROWS }),
    [rows, src.partyMeta, src.data.partyColorMap, detail.data],
  );
  if (!id) return null;
  const d = detail.data;
  const tracked = src.watchlist.some(w => w.const_id === id);
  const name = d?.name ?? displayNameFromConstId(id);
  const allDeclared = (rows ?? []).some(r => r.status === 'WON');
  const live: SeatDialogVM['live'] =
    src.election.status === 'Upcoming' ? null
    : src.election.status === 'Finalized' || allDeclared ? { kind: 'declared' }
    : { kind: 'counting', round: d?.current_round && d.total_rounds ? { current: d.current_round, total: d.total_rounds } : null };
  const fullAnalysis = analysis.data ?? null;
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
