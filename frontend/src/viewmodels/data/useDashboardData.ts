import { headlineMargin } from '../../model/derive/uncontested';
import { isThreeWay, seatSplits } from '../../model/derive/voteSplits';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApi } from './useApi';
import { getAlliances, getVoteShare, getResults, getManifest, ElectionService } from '../../model/api/election.service';
import { useThemedColor } from '../theme/useThemedColor';
import { leaderMap } from '../../model/live/liveUpdates';
import { useLiveSnapshot } from './useLiveSnapshot';
import { shouldPoll, type LiveElectionStatus } from '../../model/live/poller';
import { buildStateByConstId, displayNameFromConstId } from '../../model/geo/regionMatching';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import type { Election, ResultRow, ManifestData, VoteShare, SeatLiveState } from '../../model/types';
import type { PartySeats, SeatResult } from '../../model/types/dashboard';
import type { SeatTrail } from '../../model/derive/seatAnalysis';
import { LS_MAP_URL } from '../../model/geo/maps';

export interface MapRegionViewModel extends SeatResult {
  color: string;
  candidate: string;
  partyColor: string;
  recentChange: boolean;
}

export interface SpoilerViewModel {
  spoilerSeats: Set<string>;
  threeWaySeats: Set<string>;
  hasData: boolean;
}

export type MapPartyViewModel = PartySeats;

export interface AddableItem {
  id: string;
  name: string;
  color: string;
  type: 'alliance' | 'party';
}

export interface DashboardViewModel {
  results: ResultRow[];
  /** Per-seat ingest state of the live snapshot (empty without one). */
  seats: Record<string, SeatLiveState>;
  /** Per-seat counting trail of the live snapshot (empty without one). */
  trails: Record<string, SeatTrail>;
  manifestData: ManifestData | null;
  constCandidates: Map<string, ResultRow[]>;
  currentWinnerMap: Map<string, ResultRow>;
  partyColorMap: Map<string, string>;
  partyNameMap: Map<string, string>;
  mapPartyList: MapPartyViewModel[];
  mapRegions: MapRegionViewModel[];
  voteShare: VoteShare[];
  spoilerData: SpoilerViewModel;
  loading: boolean;
  error: string | null;
  refreshAll: () => void;
  /** Live election: true while polling succeeds (false for elections that are not live). */
  liveConnected: boolean;
  /** Latest status from /live (a page opened while Upcoming sees the flip to Live), else the page-load status. */
  liveStatus: LiveElectionStatus | null;
  /** Version of the snapshot on screen (null when the data did not come from a live snapshot). */
  liveVersion: number | null;
}

const NO_SEATS: Record<string, SeatLiveState> = {};
const NO_TRAILS: Record<string, SeatTrail> = {};
const PENDING_FILL = 'var(--map-default-fill)';

/**
 * CONTROLLER: Dashboard Data (MVC)
 * Standardizes primary dashboard data flow and derived state processing.
 */
export function useDashboardData(election: Election | null): DashboardViewModel {

  // 1. Data Fetching (SOLID: DIP - Cache keys managed by Service)
  // A live (or soon-live) election polls a versioned snapshot: results, seat tally and vote
  // share then come from one snapshot, so the map, scoreboard and standings update together.
  // Live at page load → only the snapshot is fetched; Upcoming → the plain endpoints until
  // the first snapshot arrives.
  const isLive = election?.status === 'Live';
  const polling = useMemo(() => (election ? shouldPoll(election) : false), [election]);
  const fetched = election && !isLive ? election.id : null;
  const live = useLiveSnapshot(election?.id, polling);
  const snap = live.snapshot;

  const { data: fetchedPartySeats, loading: aLoading, error: aError, refetch: refetchAlliances } = useApi(
    () => fetched ? getAlliances(fetched) : Promise.resolve([]),
    [fetched],
    { key: fetched ? ElectionService.getCacheKey(fetched, 'alliances') : undefined }
  );

  const { data: fetchedVoteShare, loading: vLoading, refetch: refetchVoteShare } = useApi(
    () => fetched ? getVoteShare(fetched) : Promise.resolve([]),
    [fetched],
    { key: fetched ? ElectionService.getCacheKey(fetched, 'voteshare') : undefined }
  );

  const { data: fetchedResults, loading: rLoading, error: rError, refetch: refetchResults } = useApi(
    () => fetched ? getResults(fetched) : Promise.resolve([]),
    [fetched],
    { key: fetched ? ElectionService.getCacheKey(fetched, 'results') : undefined }
  );

  const rawPartySeats = snap ? snap.summary : isLive ? null : fetchedPartySeats;
  const rawVoteShare = snap ? snap.voteShare : isLive ? null : fetchedVoteShare;
  const results = snap ? snap.results : isLive ? null : fetchedResults;

  const { data: rawManifest } = useApi(
    () => election ? getManifest(election.id) : Promise.resolve(null),
    [election?.id],
    { key: election ? ElectionService.getCacheKey(election.id, 'manifest') : undefined }
  );

  // Party colours fitted to the theme (useThemedColor): every colour the views, map and model see comes from these.
  const themed = useThemedColor();
  const partySeats = useMemo(() => themed.rows(rawPartySeats), [rawPartySeats, themed]);
  const voteShare = useMemo(() => themed.rows(rawVoteShare), [rawVoteShare, themed]);
  const manifest = useMemo(() => {
    const draft = rawManifest?.draft;
    if (!rawManifest || !draft?.alliances) return rawManifest;
    return { ...rawManifest, draft: { ...draft, alliances: themed.rows(draft.alliances) } };
  }, [rawManifest, themed]);

  // LS results carry no state info; resolve it from the PC GeoJSON (shared, cached fetch with the map).
  const isLS = election?.type === 'LS';
  const [lsFeatures, setLsFeatures] = useState<GeoFeature[] | null>(null);
  useEffect(() => {
    if (!isLS) return;
    let active = true;
    ElectionService.getGeoJSON(LS_MAP_URL)
      .then(fc => { if (active) setLsFeatures(fc.features as GeoFeature[]); })
      .catch(() => { /* map shows its own error; states just stay unresolved */ });
    return () => { active = false; };
  }, [isLS]);

  const manifestData = useMemo(() => manifest?.draft || null, [manifest]);

  // 2. Computed Models (SRP: Logic moved out of View)

  const constCandidates = useMemo(() => {
    const map = new Map<string, ResultRow[]>();
    (results || []).forEach(r => {
      const arr = map.get(r.const_id) || [];
      arr.push(r);
      map.set(r.const_id, arr);
    });
    for (const [, arr] of map) arr.sort((a, b) => b.votes - a.votes);
    return map;
  }, [results]);

  const currentWinnerMap = useMemo(() => leaderMap(results || []), [results]);

  // Colour / name lookup over all parties.
  const { partyColorMap, partyNameMap } = useMemo(() => {
    const colors = new Map<string, string>();
    const names = new Map<string, string>();
    (voteShare || []).forEach(v => { colors.set(v.party_id, v.color); names.set(v.party_id, v.party_name); });
    (partySeats || []).forEach(a => { colors.set(a.party_id, a.color); names.set(a.party_id, a.party_name); });
    return { partyColorMap: colors, partyNameMap: names };
  }, [voteShare, partySeats]);

  const stateByConst = useMemo(
    () => (isLS && lsFeatures ? buildStateByConstId(constCandidates.keys(), lsFeatures) : new Map<string, string>()),
    [isLS, lsFeatures, constCandidates]
  );

  const mapRegions = useMemo((): MapRegionViewModel[] => {
    return Array.from(constCandidates.entries()).map(([id, candidates]) => {
      const winner = currentWinnerMap.get(id);
      const color = winner ? (partyColorMap.get(winner.party_id) || PENDING_FILL) : PENDING_FILL;
      return {
        id,
        name: displayNameFromConstId(id),
        state: stateByConst.get(id),
        color,
        candidate: winner?.candidate_name || '',
        party: winner?.party_id || '',
        partyColor: color,
        ...headlineMargin(candidates, winner),
        status: winner?.status || 'PENDING',
        type: candidates[0]?.const_type || 'GEN',
        recentChange: false,
      };
    });
  }, [constCandidates, currentWinnerMap, partyColorMap, stateByConst]);

  const spoilerData = useMemo((): SpoilerViewModel => {
    if (!constCandidates || constCandidates.size === 0) return { spoilerSeats: new Set(), threeWaySeats: new Set(), hasData: false };

    const spoilerSeats = new Set<string>();
    const threeWaySeats = new Set<string>();

    const partyToAlliance = new Map<string, string>();
    (manifestData?.alliances || []).forEach(a => a.parties.forEach(pid => partyToAlliance.set(pid.toUpperCase(), a.id)));
    const allianceOf = (p: string) => partyToAlliance.get(p.toUpperCase()) ?? null;
    // The one vote-split rule (model/derive/voteSplits), as the insight chips and the summary use.
    for (const [constId, cands] of constCandidates) {
      if (isThreeWay(cands)) threeWaySeats.add(constId);
      if (seatSplits(cands, manifestData?.vote_splits || [], allianceOf).length) spoilerSeats.add(constId);
    }
    return { spoilerSeats, threeWaySeats, hasData: true };
  }, [constCandidates, manifestData]);

  // Seats (won + leading) per party from the server tally.
  const partySeatCounts = useMemo(() => {
    const seats = new Map<string, number>();
    (partySeats || []).forEach(a => seats.set(a.party_id, Number(a.won) + Number(a.leading)));
    return seats;
  }, [partySeats]);

  // All parties — deliberately independent of the standings panel's tracked subset,
  // so hiding a row there doesn't change map filters, legend or summary lookups.
  const mapPartyList = useMemo(() => {
    const ids = new Set<string>([...(partySeats || []).map(a => a.party_id), ...(voteShare || []).map(v => v.party_id)]);
    const list: MapPartyViewModel[] = [...ids].map(id => ({
      id,
      name: partyNameMap.get(id) || id,
      color: partyColorMap.get(id) || '#6b7280',
      seats: partySeatCounts.get(id) || 0,
    }));
    return list.sort((a, b) => b.seats - a.seats);
  }, [partySeats, voteShare, partyNameMap, partyColorMap, partySeatCounts]);

  const { pollNow } = live;
  const refreshAll = useCallback(() => {
    if (polling) pollNow();
    refetchAlliances();
    refetchVoteShare();
    refetchResults();
  }, [polling, pollNow, refetchAlliances, refetchVoteShare, refetchResults]);


  return {
    results: results || [],
    seats: snap?.seats ?? NO_SEATS,
    trails: snap?.trail ?? NO_TRAILS,
    manifestData,
    constCandidates,
    currentWinnerMap,
    partyColorMap,
    partyNameMap,
    mapPartyList,
    mapRegions,
    voteShare: voteShare || [],
    spoilerData,
    // Live: loading until the first snapshot; after repeated poll failures an error (with Retry).
    loading: snap ? false : isLive ? !live.error : aLoading || vLoading || rLoading,
    error: snap ? null : isLive ? live.error : aError || rError,
    refreshAll,
    liveConnected: live.connected,
    liveStatus: live.status ?? election?.status ?? null,
    liveVersion: snap?.version ?? null,
  };
}
