import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../data/useApi';
import { useLiveSnapshot } from '../data/useLiveSnapshot';
import { usePartyMeta } from '../data/usePartyMeta';
import { useLocalStorage } from '../data/useLocalStorage';
import { getElection, getConstituency, getConstituencyAnalysis, getManifest, ElectionService } from '../../model/api/election.service';
import { ApiError } from '../../model/api/api-client';
import { matchFeaturesToSeats } from '../../model/geo/featureMatch';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import { buildSeatView, detailToRows, seatHistory, seatNotes, type SeatView, type SeatNote } from '../../model/derive/seatView';
import type { PartyMeta } from '../../model/derive/partyMeta';
import type { CustomWatch } from '../../model/derive/leaders';
import type { SeatHistoryEntry, Election } from '../../model/types';
import type { SeatDialogVM } from '../tiles/useSeatDialogVM';

const LS_PC = '/geo/india_pc.geojson';
const NOT_FOUND = 'NOT_FOUND' as const;

export interface ConstituencyPageVM {
  status: 'loading' | 'error' | 'notFound' | 'ready';
  electionName: string; electionHref: string; stateName: string | null; districtName: string | null;
  name: string; constNo: number | null; type: 'GEN' | 'SC' | 'ST' | null;
  live: SeatDialogVM['live'];
  facts: { electors: number | null; votesPolled: number | null; turnout: number | null; phase: number | null; region: string | null; district: string | null; progress: { current: number; total: number } | null };
  /** All candidates, NOTA last, no cap. */
  view: SeatView;
  history: SeatHistoryEntry[]; dominance: string | null; notes: SeatNote[];
  partyMeta: Map<string, PartyMeta>;
  locator: { features: GeoFeature[]; seat: GeoFeature | null } | null;
  tracked: boolean; onToggleTrack(): void; shareText: string; personHref(id: string): string;
  /** The election dashboard with this party's dialog open. */
  partyHref(id: string): string;
  /** For the page to sync the global election context on a direct load. */
  election: Election | null;
}

export function useConstituencyPageVM(electionId: string, constId: string): ConstituencyPageVM {
  const partyMeta = usePartyMeta();
  const election = useApi(() => getElection(electionId), [electionId], { key: ElectionService.getCacheKey(electionId) });
  // useApi's error is a string, so a 404 is turned into a value here.
  const detailRes = useApi(
    () => getConstituency(electionId, constId).catch(e => { if (e instanceof ApiError && e.status === 404) return NOT_FOUND; throw e; }),
    [electionId, constId], { key: ElectionService.getConstituencyCacheKey(electionId, constId) },
  );
  const notFound = detailRes.data === NOT_FOUND;
  // useApi keeps the previous seat's data while the next loads: only use data that belongs to this seat.
  const d = detailRes.data && detailRes.data !== NOT_FOUND && detailRes.data.id === constId ? detailRes.data : null;
  const analysisRes = useApi(() => getConstituencyAnalysis(electionId, constId).catch(() => null), [electionId, constId], { key: `${ElectionService.getConstituencyCacheKey(electionId, constId)}_analysis` });
  const analysis = analysisRes.data && (!analysisRes.data.const_id || analysisRes.data.const_id === constId) ? analysisRes.data : null;
  const manifest = useApi(() => getManifest(electionId).catch(() => null), [electionId], { key: ElectionService.getCacheKey(electionId, 'manifest') });
  const e = election.data && election.data.id === electionId ? election.data : null;
  const isLive = e?.status === 'Live';
  const live = useLiveSnapshot(electionId, isLive);
  // Same key as the dashboard watchlist, so tracking is shared.
  const [watch, setWatch] = useLocalStorage<CustomWatch[]>(`watchlist_${electionId}`, []);

  const rows = useMemo(() => {
    const snapRows = live.snapshot?.results.filter(r => r.const_id === constId);
    return snapRows && snapRows.length ? snapRows : d ? detailToRows(constId, d.candidates ?? []) : [];
  }, [live.snapshot, d, constId]);
  const partyColor = useMemo(() => new Map((d?.candidates ?? []).filter(c => c.party).map(c => [c.party!.id, c.party!.color ?? 'var(--color-fallback)'])), [d]);
  const view = useMemo(() => buildSeatView(rows, { partyMeta, partyColor, detail: d?.candidates ?? null }), [rows, partyMeta, partyColor, d]);

  const mapUrl = manifest.data?.draft?.geo?.map_url || (e?.type === 'LS' ? LS_PC : null);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  useEffect(() => {
    if (!mapUrl) return;
    let on = true;
    ElectionService.getGeoJSON(mapUrl).then(fc => { if (on) setFeatures((fc?.features ?? []) as GeoFeature[]); }).catch(() => {});
    return () => { on = false; };
  }, [mapUrl]);
  const locator = useMemo(() => {
    if (!features.length || !d) return null;
    const matched = matchFeaturesToSeats(features, [{ id: constId, name: d.name, state: d.state?.name }]);
    const seat = [...matched.keys()][0] ?? null;
    // LS: the PC file covers India, so show only the seat's state.
    const shown = e?.type === 'LS' && seat ? features.filter(f => f.properties?.st_name === seat.properties?.st_name) : features;
    return { features: shown, seat };
  }, [features, d, constId, e?.type]);

  const status: ConstituencyPageVM['status'] = notFound ? 'notFound' : detailRes.error || election.error ? 'error' : d && e ? 'ready' : 'loading';
  const tracked = watch.some(w => w.const_id === constId);
  const declared = rows.some(r => r.status === 'WON');
  const progress = d?.current_round && d.total_rounds ? { current: d.current_round, total: d.total_rounds } : null;
  return {
    status,
    electionName: e?.name ?? '', electionHref: `/election/${electionId}`,
    stateName: d?.state?.name ?? null, districtName: d?.district?.name ?? null,
    name: d?.name ?? '', constNo: d?.const_no ?? null, type: d?.type ?? null,
    live: !e || e.status === 'Upcoming' ? null : e.status === 'Finalized' || declared ? { kind: 'declared' } : { kind: 'counting', round: progress },
    facts: {
      electors: d?.total_electors ?? null, votesPolled: view.totalVotes > 0 ? view.totalVotes : null,
      turnout: d?.voter_turnout != null ? Number(d.voter_turnout) : null, phase: d?.phase ?? null,
      region: d?.region?.name ?? null, district: d?.district?.name ?? null, progress,
    },
    view,
    history: seatHistory(analysis, e?.year ?? 0),
    dominance: (analysis as { dominance?: string } | null)?.dominance ?? null,
    notes: seatNotes(view, analysis),
    partyMeta,
    locator,
    tracked,
    onToggleTrack: () => setWatch(tracked ? watch.filter(w => w.const_id !== constId) : [...watch, { const_id: constId, label: d?.name ?? constId }]),
    shareText: `${d?.name ?? ''} — ${e?.name ?? ''} · MatdaanPulse`,
    personHref: id => `/person/${id}`,
    partyHref: id => `/election/${electionId}?party=${encodeURIComponent(id)}`,
    election: e,
  };
}
