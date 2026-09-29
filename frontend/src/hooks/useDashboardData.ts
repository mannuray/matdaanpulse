import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApi } from './useApi';
import { getAlliances, getVoteShare, getResults, getManifest, ElectionService } from '../services/election.service';
import { DashboardService } from '../services/dashboard.service';
import { useLocalStorage } from './useLocalStorage';
import { applyLiveRows, mergeWinnerOverlay } from '../utils/liveUpdates';
import type { LeaderChange, LeaderPatch } from '../utils/liveUpdates';
import { buildStateByConstId, displayNameFromConstId } from '../utils/regionMatching';
import type { GeoFeature } from '../utils/geoHelpers';
import type { Election, MapTab, ResultRow, ManifestData, StandingsData, SSEResultData } from '../types';

export interface MapRegionViewModel {
  id: string;
  name: string;
  /** Geo `st_name` of the constituency (LS only; derived from id prefix or GeoJSON). */
  state?: string;
  color: string;
  candidate: string;
  party: string;
  partyColor: string;
  /** Leader's margin; undefined when no candidate is leading/won yet. */
  margin?: number;
  /** WON | LEADING, or PENDING when no result yet. */
  status: string;
  type: 'GEN' | 'SC' | 'ST';
  recentChange: boolean;
}

export interface SpoilerViewModel {
  spoilerSeats: Set<string>;
  threeWaySeats: Set<string>;
  hasData: boolean;
}

export interface MapPartyViewModel {
  id: string;
  name: string;
  color: string;
  seats: number;
}

export interface AddableItem {
  id: string;
  name: string;
  color: string;
  type: 'alliance' | 'party';
}

export interface DashboardViewModel {
  results: ResultRow[];
  manifestData: ManifestData | null;
  standings: StandingsData;
  constCandidates: Map<string, ResultRow[]>;
  currentWinnerMap: Map<string, ResultRow>;
  partyColorMap: Map<string, string>;
  partyNameMap: Map<string, string>;
  mapPartyList: MapPartyViewModel[];
  mapRegions: MapRegionViewModel[];
  spoilerData: SpoilerViewModel;
  addableItems: AddableItem[];
  loading: boolean;
  error: string | null;
  modalConstId: string | null;
  setModalConstId: (id: string | null) => void;
  mapTab: MapTab;
  setMapTab: (tab: MapTab) => void;
  userTracked: string[];
  setUserTracked: (ids: string[]) => void;
  /** Remove an alliance/party from the standings panel. */
  untrack: (id: string) => void;
  spoilerFilter: string | null;
  setSpoilerFilter: (id: string | null) => void;
  refreshAll: () => void;
  /** Apply SSE rows to local state immediately; returns the leader changes. Schedules a debounced full refresh. */
  applyLiveUpdate: (rows: SSEResultData[]) => LeaderChange[];
}

const PENDING_FILL = 'var(--map-default-fill)';
/** Trailing debounce for the authoritative refetch after live events. */
const LIVE_REFRESH_DEBOUNCE_MS = 4000;
const LS_GEO_URL = '/geo/india_pc.geojson';

/**
 * CONTROLLER: Dashboard Data (MVC)
 * Standardizes primary dashboard data flow and derived state processing.
 */
export function useDashboardData(election: Election | null): DashboardViewModel {
  const [modalConstId, setModalConstId] = useState<string | null>(null);
  const [mapTab, setMapTab] = useState<MapTab>('overview');
  const [userTracked, setUserTracked] = useLocalStorage<string[]>(election ? `tracked_${election.id}` : null, []);
  const [spoilerFilter, setSpoilerFilter] = useState<string | null>(null);
  const [liveOverlay, setLiveOverlay] = useState<Map<string, LeaderPatch>>(() => new Map());

  // 1. Data Fetching (SOLID: DIP - Cache keys managed by Service)
  const { data: partySeats, loading: aLoading, error: aError, refetch: refetchAlliances } = useApi(
    () => election ? getAlliances(election.id) : Promise.resolve([]),
    [election?.id],
    { key: election ? ElectionService.getCacheKey(election.id, 'alliances') : undefined }
  );

  const { data: voteShare, loading: vLoading, refetch: refetchVoteShare } = useApi(
    () => election ? getVoteShare(election.id) : Promise.resolve([]),
    [election?.id],
    { key: election ? ElectionService.getCacheKey(election.id, 'voteshare') : undefined }
  );

  const { data: results, loading: rLoading, error: rError, refetch: refetchResults } = useApi(
    () => election ? getResults(election.id) : Promise.resolve([]),
    [election?.id],
    { key: election ? ElectionService.getCacheKey(election.id, 'results') : undefined }
  );

  const { data: manifest } = useApi(
    () => election ? getManifest(election.id) : Promise.resolve(null),
    [election?.id],
    { key: election ? ElectionService.getCacheKey(election.id, 'manifest') : undefined }
  );

  // LS results carry no state info; resolve it from the PC GeoJSON (shared, cached fetch with the map).
  const isLS = election?.type === 'LS';
  const [lsFeatures, setLsFeatures] = useState<GeoFeature[] | null>(null);
  useEffect(() => {
    if (!isLS) return;
    let active = true;
    ElectionService.getGeoJSON(LS_GEO_URL)
      .then(fc => { if (active) setLsFeatures(fc.features as GeoFeature[]); })
      .catch(() => { /* map shows its own error; states just stay unresolved */ });
    return () => { active = false; };
  }, [isLS]);

  // Fresh server data supersedes any live patches.
  useEffect(() => { setLiveOverlay(new Map()); }, [results]);

  const manifestData = useMemo(() => manifest?.draft || null, [manifest]);
  const trackedIds = useMemo(() => new Set(userTracked || []), [userTracked]);
  const manifestIds = useMemo(() => {
    const ids = new Set<string>();
    manifestData?.alliances?.forEach(a => a.parties.forEach(p => ids.add(p)));
    return ids;
  }, [manifestData]);

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

  const fetchedWinnerMap = useMemo(() => {
    const map = new Map<string, ResultRow>();
    (results || []).filter(r => r.status === 'WON' || r.status === 'LEADING')
      .forEach(r => {
        if (!map.has(r.const_id) || r.votes > (map.get(r.const_id)?.votes || 0)) {
          map.set(r.const_id, r);
        }
      });
    return map;
  }, [results]);

  const currentWinnerMap = useMemo(
    () => mergeWinnerOverlay(fetchedWinnerMap, liveOverlay, constCandidates),
    [fetchedWinnerMap, liveOverlay, constCandidates]
  );

  const standings = useMemo(() => {
    if (!partySeats || !voteShare) return { groups: [], independents: [] };
    return DashboardService.buildStandings(
      partySeats,
      voteShare,
      manifestData?.alliances || [],
      trackedIds,
      manifestIds
    );
  }, [partySeats, voteShare, manifestData, trackedIds, manifestIds]);

  // Colour / name lookup over all parties (not just the tracked subset shown in standings).
  const { partyColorMap, partyNameMap } = useMemo(() => {
    const colors = new Map<string, string>();
    const names = new Map<string, string>();
    (voteShare || []).forEach(v => { colors.set(v.party_id, v.color); names.set(v.party_id, v.party_name); });
    (partySeats || []).forEach(a => { colors.set(a.party_id, a.color); names.set(a.party_id, a.party_name); });
    standings.groups.forEach(g => g.parties.forEach(p => { colors.set(p.id, p.color); names.set(p.id, p.name); }));
    standings.independents.forEach(p => { colors.set(p.id, p.color); names.set(p.id, p.name); });
    return { partyColorMap: colors, partyNameMap: names };
  }, [standings, voteShare, partySeats]);

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
        margin: winner ? (Number(winner.margin) || 0) : undefined,
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
    (manifestData?.alliances || []).forEach(a => a.parties.forEach(pid => partyToAlliance.set(pid, a.id)));

    for (const [constId, cands] of constCandidates) {
      if (cands.length < 3) continue;
      const total = cands.reduce((s, c) => s + c.votes, 0);
      if (total === 0) continue;

      const thirdShare = (cands[2].votes / total) * 100;
      if (thirdShare >= 15) threeWaySeats.add(constId);

      const winner = cands[0];
      const runnerUp = cands[1];
      const winnerMargin = winner.votes - runnerUp.votes;
      const runnerUpAlliance = partyToAlliance.get(runnerUp.party_id);

      (manifestData?.vote_splits || []).forEach(vs => {
        const spoilerCand = cands.find(c => c.party_id === vs.spoiler);
        if (spoilerCand && spoilerCand.votes > winnerMargin && runnerUpAlliance === vs.hurts) {
          spoilerSeats.add(constId);
        }
      });
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

  // Everything that could appear in the standings panel, for the "+" (add) picker.
  const allStandingItems = useMemo((): AddableItem[] => {
    const items: AddableItem[] = [];
    (manifestData?.alliances || []).forEach(a => items.push({ id: a.id, name: a.name, color: a.color, type: 'alliance' }));
    mapPartyList
      .filter(p => !manifestIds.has(p.id))
      .forEach(p => items.push({ id: p.id, name: p.name, color: p.color, type: 'party' }));
    return items;
  }, [manifestData, mapPartyList, manifestIds]);

  const displayedIds = useMemo(() => {
    const ids = new Set<string>();
    standings.groups.forEach(g => ids.add(g.id));
    standings.independents.forEach(p => ids.add(p.id));
    return ids;
  }, [standings]);

  const addableItems = useMemo(
    () => allStandingItems.filter(i => !displayedIds.has(i.id)).slice(0, 40),
    [allStandingItems, displayedIds]
  );

  const untrack = useCallback((id: string) => {
    // With nothing tracked, everything is shown: start tracking all displayed items minus this one.
    const base = (userTracked && userTracked.length > 0) ? userTracked : [...displayedIds];
    setUserTracked(base.filter(x => x !== id));
  }, [userTracked, displayedIds, setUserTracked]);

  const refreshAll = useCallback(() => {
    refetchAlliances();
    refetchVoteShare();
    refetchResults();
  }, [refetchAlliances, refetchVoteShare, refetchResults]);

  // Debounced authoritative refresh after live events (the backend purges its
  // cache after publishing, so an immediate refetch could also return stale data).
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;
  useEffect(() => () => clearTimeout(refreshTimerRef.current), []);
  useEffect(() => { clearTimeout(refreshTimerRef.current); }, [election?.id]);

  const overlayRef = useRef(liveOverlay);
  overlayRef.current = liveOverlay;
  const fetchedWinnerRef = useRef(fetchedWinnerMap);
  fetchedWinnerRef.current = fetchedWinnerMap;

  const applyLiveUpdate = useCallback((rows: SSEResultData[]): LeaderChange[] => {
    const { overlay, changes } = applyLiveRows(overlayRef.current, rows, fetchedWinnerRef.current);
    if (overlay !== overlayRef.current) {
      overlayRef.current = overlay;
      setLiveOverlay(overlay);
    }
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => refreshAllRef.current(), LIVE_REFRESH_DEBOUNCE_MS);
    return changes;
  }, []);

  return {
    results: results || [],
    manifestData,
    standings,
    constCandidates,
    currentWinnerMap,
    partyColorMap,
    partyNameMap,
    mapPartyList,
    mapRegions,
    spoilerData,
    addableItems,
    loading: aLoading || vLoading || rLoading,
    error: aError || rError,
    modalConstId,
    setModalConstId,
    mapTab,
    setMapTab,
    userTracked: userTracked || [],
    setUserTracked,
    untrack,
    spoilerFilter,
    setSpoilerFilter,
    refreshAll,
    applyLiveUpdate,
  };
}
