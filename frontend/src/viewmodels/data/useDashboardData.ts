import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApi } from './useApi';
import { getAlliances, getVoteShare, getResults, getManifest, ElectionService } from '../../model/api/election.service';
import { DashboardService } from '../../model/api/dashboard.service';
import { useLocalStorage } from './useLocalStorage';
import { useTheme } from '../theme/useTheme';
import { forTheme, type ThemeName } from '../../model/derive/themeColor';
import { leaderMap } from '../../model/live/liveUpdates';
import { useLiveSnapshot } from './useLiveSnapshot';
import { buildStateByConstId, displayNameFromConstId } from '../../model/geo/regionMatching';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import type { Election, MapTab, ResultRow, ManifestData, StandingsData, VoteShare } from '../../model/types';
import type { PartySeats, SeatResult } from '../../model/types/dashboard';

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
  manifestData: ManifestData | null;
  standings: StandingsData;
  constCandidates: Map<string, ResultRow[]>;
  currentWinnerMap: Map<string, ResultRow>;
  partyColorMap: Map<string, string>;
  partyNameMap: Map<string, string>;
  mapPartyList: MapPartyViewModel[];
  mapRegions: MapRegionViewModel[];
  voteShare: VoteShare[];
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
  /** Live election: true while polling succeeds (false for elections that are not live). */
  liveConnected: boolean;
}

const PENDING_FILL = 'var(--map-default-fill)';
const LS_GEO_URL = '/geo/india_pc.geojson';

function recolor<R extends { color: string }[] | null | undefined>(rows: R, theme: ThemeName): R {
  if (!rows || theme === 'dark') return rows;
  return rows.map(r => ({ ...r, color: forTheme(r.color, theme) })) as R;
}

/**
 * CONTROLLER: Dashboard Data (MVC)
 * Standardizes primary dashboard data flow and derived state processing.
 */
export function useDashboardData(election: Election | null): DashboardViewModel {
  const [modalConstId, setModalConstId] = useState<string | null>(null);
  const [mapTab, setMapTab] = useState<MapTab>('overview');
  const [userTracked, setUserTracked] = useLocalStorage<string[]>(election ? `tracked_${election.id}` : null, []);
  const [spoilerFilter, setSpoilerFilter] = useState<string | null>(null);

  // 1. Data Fetching (SOLID: DIP - Cache keys managed by Service)
  // A live election polls a versioned snapshot instead: results, seat tally and vote share
  // then come from one snapshot, so the map, scoreboard and standings update together.
  const isLive = election?.status === 'Live';
  const fetched = election && !isLive ? election.id : null;
  const live = useLiveSnapshot(election?.id, isLive);

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

  const rawPartySeats = isLive ? live.snapshot?.summary ?? null : fetchedPartySeats;
  const rawVoteShare = isLive ? live.snapshot?.voteShare ?? null : fetchedVoteShare;
  const results = isLive ? live.snapshot?.results ?? null : fetchedResults;

  const { data: rawManifest } = useApi(
    () => election ? getManifest(election.id) : Promise.resolve(null),
    [election?.id],
    { key: election ? ElectionService.getCacheKey(election.id, 'manifest') : undefined }
  );

  // The one place party colours are adapted to the theme: every colour the views, map and model see comes from these.
  const { theme } = useTheme();
  const partySeats = useMemo(() => recolor(rawPartySeats, theme), [rawPartySeats, theme]);
  const voteShare = useMemo(() => recolor(rawVoteShare, theme), [rawVoteShare, theme]);
  const manifest = useMemo(() => {
    const draft = rawManifest?.draft;
    if (!rawManifest || !draft?.alliances) return rawManifest;
    return { ...rawManifest, draft: { ...draft, alliances: recolor(draft.alliances, theme) } };
  }, [rawManifest, theme]);

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

  const currentWinnerMap = useMemo(() => leaderMap(results || []), [results]);

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
    voteShare: voteShare || [],
    spoilerData,
    addableItems,
    // Live: loading until the first snapshot; the poller retries errors by itself.
    loading: isLive ? !live.snapshot : aLoading || vLoading || rLoading,
    error: isLive ? null : aError || rError,
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
    liveConnected: live.connected,
  };
}
