import { useState, useMemo, useCallback } from 'react';
import { useApi } from './useApi';
import { getAlliances, getVoteShare, getResults, getManifest, ElectionService } from '../services/election.service';
import { DashboardService } from '../services/dashboard.service';
import { useLocalStorage } from './useLocalStorage';
import type { Election, MapTab, ResultRow, ManifestData, StandingsData } from '../types';

export interface MapRegionViewModel {
  id: string;
  name: string;
  color: string;
  candidate: string;
  party: string;
  partyColor: string;
  margin: number;
  status: string;
  type: 'GEN' | 'SC' | 'ST';
  recentChange: boolean;
}

export interface SpoilerViewModel {
  spoilerSeats: Set<string>;
  threeWaySeats: Set<string>;
  hasData: boolean;
}

export interface DashboardViewModel {
  results: ResultRow[];
  manifestData: ManifestData | null;
  standings: StandingsData;
  constCandidates: Map<string, ResultRow[]>;
  currentWinnerMap: Map<string, ResultRow>;
  partyColorMap: Map<string, string>;
  mapPartyList: any[];
  mapRegions: MapRegionViewModel[];
  spoilerData: SpoilerViewModel;
  loading: boolean;
  error: string | null;
  modalConstId: string | null;
  setModalConstId: (id: string | null) => void;
  mapTab: MapTab;
  setMapTab: (tab: MapTab) => void;
  userTracked: string[];
  setUserTracked: (ids: string[]) => void;
  spoilerFilter: string | null;
  setSpoilerFilter: (id: string | null) => void;
  refreshAll: () => void;
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

  const currentWinnerMap = useMemo(() => {
    const map = new Map<string, ResultRow>();
    (results || []).filter(r => r.status === 'WON' || r.status === 'LEADING')
      .forEach(r => {
        if (!map.has(r.const_id) || r.votes > (map.get(r.const_id)?.votes || 0)) {
          map.set(r.const_id, r);
        }
      });
    return map;
  }, [results]);

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

  const partyColorMap = useMemo(() => {
    const m = new Map<string, string>();
    standings.groups.forEach(g => g.parties.forEach(p => m.set(p.id, p.color)));
    standings.independents.forEach(p => m.set(p.id, p.color));
    return m;
  }, [standings]);

  const mapRegions = useMemo((): MapRegionViewModel[] => {
    return Array.from(constCandidates.entries()).map(([id, candidates]) => {
      const winner = currentWinnerMap.get(id);
      const color = winner ? (partyColorMap.get(winner.party_id) || '#d1d5db') : '#d1d5db';
      return {
        id,
        name: id.replace(/_/g, ' '),
        color,
        candidate: winner?.candidate_name || '',
        party: winner?.party_id || '',
        partyColor: color,
        margin: winner?.margin || 0,
        status: winner?.status || 'TRAILING',
        type: (candidates[0]?.const_type || 'GEN') as any,
        recentChange: false,
      };
    });
  }, [constCandidates, currentWinnerMap, partyColorMap]);

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

  const mapPartyList = useMemo(() => {
    const list: any[] = [];
    standings.groups.forEach(g => {
      g.parties.forEach(p => {
        list.push({ id: p.id, name: p.name, color: p.color, seats: p.won + p.leading });
      });
    });
    standings.independents.forEach(p => {
      list.push({ id: p.id, name: p.name, color: p.color, seats: p.won + p.leading });
    });
    return list.sort((a, b) => b.seats - a.seats);
  }, [standings]);

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
    mapPartyList,
    mapRegions,
    spoilerData,
    loading: aLoading || vLoading || rLoading,
    error: aError || rError,
    modalConstId,
    setModalConstId,
    mapTab,
    setMapTab,
    userTracked: userTracked || [],
    setUserTracked,
    spoilerFilter,
    setSpoilerFilter,
    refreshAll
  };
}
