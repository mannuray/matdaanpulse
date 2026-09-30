import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardData } from '../data/useDashboardData';
import { useHistoryAnalysis } from '../data/useHistoryAnalysis';
import { useHistoricalResults } from '../data/useHistoricalResults';
import { useAnalysis } from '../data/useAnalysis';
import { useElection } from '../data/useElection';
import { useLocalStorage } from '../data/useLocalStorage';
import type { CustomWatch } from '../../model/derive/leaders';
import { appendTicker, type TickerEvent } from '../../model/live/ticker';
import { diffLeaders } from '../../model/live/liveUpdates';
import type { Election, ResultRow, SwingEntry, DominanceEntry, IncumbencyEntry, PartySwitchEntry, MarginTrendPoint, PartyTrendPoint } from '../../model/types';
import type { LayerId } from '../../model/types/dashboard';
import type { DashboardViewModel } from '../data/useDashboardData';

const RECENT_CHANGE_MS = 3000;
const EMPTY_YEARS: number[] = [];
const EMPTY_WATCH: CustomWatch[] = [];

export interface DashboardSources {
  election: Election;
  data: DashboardViewModel;
  swing: Map<string, SwingEntry>;
  dominance: Map<string, DominanceEntry>;
  incumbency: IncumbencyEntry[];
  partySwitches: PartySwitchEntry[];
  marginTrend: MarginTrendPoint[];
  partyTrend: PartyTrendPoint[];
  prevYear: number | null;
  totalSeats: number;
  majority: number;
  votePct: Map<string, number>;
  ticker: TickerEvent[];
  recentSeats: Set<string>;
  /** Live election: the last poll succeeded. */
  liveConnected: boolean;
  availableLayers: LayerId[];
  /** The user's own tracked seats (shared by the seat panel and the watchlist tab). */
  watchlist: CustomWatch[];
  addWatch(constId: string, label: string): void;
  removeWatch(constId: string): void;
}

export function useDashboardSources(election: Election): DashboardSources {
  const data = useDashboardData(election);
  const { setLiveConnected } = useElection();
  const { manifestData, results, currentWinnerMap, constCandidates, mapRegions, voteShare, liveConnected } = data;

  const historyResults = useHistoricalResults(manifestData?.history);
  const prevResults = historyResults && historyResults.length > 0 ? historyResults[historyResults.length - 1] : null;
  const allConstIds = useMemo(() => [...constCandidates.keys()], [constCandidates]);
  const ha = useHistoryAnalysis({
    results, currentWinnerMap, allHistResults: historyResults, prevResults, allConstIds,
    historyYears: manifestData?.history_years || EMPTY_YEARS, currentYear: election.year,
  });
  const ba = useAnalysis(election.status === 'Finalized' ? election.id : undefined);

  const swing = ba.swingMap.size > 0 ? ba.swingMap : ha.swingMap;
  const dominance = ba.dominanceMap.size > 0 ? ba.dominanceMap : ha.dominanceMap;
  const incumbency = ba.incumbencyData.length > 0 ? ba.incumbencyData : ha.incumbencyData;
  const partySwitches = ba.partySwitchData.length > 0 ? ba.partySwitchData : ha.partySwitchData;
  const years = manifestData?.history_years ?? [];
  const prevYear = years.length > 0 ? years[years.length - 1] : null;

  const totalSeats = election.type === 'LS' ? (mapRegions.length || 543) : (election.state?.total_assembly_seats || mapRegions.length);
  const majorityMilestone = manifestData?.milestones?.find(m => /majority/i.test(m.label))?.value;
  const majority = majorityMilestone || Math.floor(totalSeats / 2) + 1;
  const votePct = useMemo(() => new Map(voteShare.map(v => [v.party_id, Number(v.percentage)])), [voteShare]);

  // Live: ticker + recent-change pulses.
  const [ticker, setTicker] = useState<TickerEvent[]>([]);
  const [recentSeats, setRecentSeats] = useState<Set<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach(clearTimeout); t.clear(); };
  }, []);
  const markRecent = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setRecentSeats(prev => new Set([...prev, ...ids]));
    for (const id of ids) {
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => {
        timers.current.delete(id);
        setRecentSeats(prev => { const n = new Set(prev); n.delete(id); return n; });
      }, RECENT_CHANGE_MS));
    }
  }, []);
  // Each new live snapshot is diffed against the previous one of the same election:
  // seats whose leader changed feed the ticker and pulse on the map. The first
  // snapshot (and the first after switching elections) is the baseline, not news.
  const prevSnapshot = useRef<{ electionId: string; results: ResultRow[] } | null>(null);
  useEffect(() => {
    if (election.status !== 'Live') { prevSnapshot.current = null; return; }
    if (results.length === 0) return;
    const prev = prevSnapshot.current;
    prevSnapshot.current = { electionId: election.id, results };
    if (!prev || prev.electionId !== election.id || prev.results === results) return;
    const changes = diffLeaders(prev.results, results);
    if (changes.length === 0) return;
    markRecent(changes.map(c => c.const_id));
    setTicker(p => appendTicker(p, changes));
  }, [results, election.id, election.status, markRecent]);
  useEffect(() => { setLiveConnected(liveConnected); }, [liveConnected, setLiveConnected]);

  const availableLayers = useMemo((): LayerId[] => {
    const l: LayerId[] = ['overview', 'battle'];
    if (swing.size > 0) l.push('swing');
    if (dominance.size > 0) l.push('history');
    l.push('demographics', 'insights');
    if (election.type === 'LS') l.push('states');
    return l;
  }, [swing.size, dominance.size, election.type]);

  // Same storage key as the baseline WatchlistPanel, so users keep their watchlist.
  const [stored, setStored] = useLocalStorage<CustomWatch[]>(`watchlist_${election.id}`, []);
  const watchlist = stored || EMPTY_WATCH;
  const addWatch = useCallback((constId: string, label: string) => {
    setStored(prev => (prev || []).some(w => w.const_id === constId) ? prev || [] : [...(prev || []), { const_id: constId, label }]);
  }, [setStored]);
  const removeWatch = useCallback((constId: string) => {
    setStored(prev => (prev || []).filter(w => w.const_id !== constId));
  }, [setStored]);

  return {
    election, data, swing, dominance, incumbency, partySwitches, marginTrend: ha.marginTrend, partyTrend: ha.partyTrend, prevYear,
    totalSeats, majority, votePct, ticker, recentSeats, liveConnected, availableLayers,
    watchlist, addWatch, removeWatch,
  };
}
