import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardData } from '../data/useDashboardData';
import { useHistoryAnalysis } from '../data/useHistoryAnalysis';
import { useHistoricalResults } from '../data/useHistoricalResults';
import { useAnalysis } from '../data/useAnalysis';
import { useSSE } from '../data/useSSE';
import { useElection } from '../data/useElection';
import { appendTicker, type TickerEvent } from '../../model/live/ticker';
import type { Election, SSEEvent, SwingEntry, DominanceEntry, IncumbencyEntry, PartySwitchEntry, MarginTrendPoint } from '../../model/types';
import type { LayerId } from '../../model/types/dashboard';
import type { DashboardViewModel } from '../data/useDashboardData';

const RECENT_CHANGE_MS = 3000;
const EMPTY_YEARS: number[] = [];

export interface DashboardSources {
  election: Election;
  data: DashboardViewModel;
  swing: Map<string, SwingEntry>;
  dominance: Map<string, DominanceEntry>;
  incumbency: IncumbencyEntry[];
  partySwitches: PartySwitchEntry[];
  marginTrend: MarginTrendPoint[];
  prevYear: number | null;
  totalSeats: number;
  majority: number;
  votePct: Map<string, number>;
  ticker: TickerEvent[];
  recentSeats: Set<string>;
  sseConnected: boolean;
  availableLayers: LayerId[];
}

export function useDashboardSources(election: Election): DashboardSources {
  const data = useDashboardData(election);
  const { setSseConnected } = useElection();
  const { manifestData, results, currentWinnerMap, constCandidates, mapRegions, voteShare, applyLiveUpdate } = data;

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
  const handleSSE = useCallback((event: SSEEvent) => {
    const rows = event.type === 'batch-update' ? event.data : [event.data];
    if (rows.length === 0) return;
    const changes = applyLiveUpdate(rows);
    markRecent(changes.map(c => c.const_id));
    setTicker(prev => appendTicker(prev, changes));
  }, [applyLiveUpdate, markRecent]);
  const { connected: sseConnected } = useSSE(election.status === 'Live' ? election.id : undefined, handleSSE);
  useEffect(() => { setSseConnected(sseConnected); }, [sseConnected, setSseConnected]);

  const availableLayers = useMemo((): LayerId[] => {
    const l: LayerId[] = ['overview', 'battle'];
    if (swing.size > 0) l.push('swing');
    if (dominance.size > 0) l.push('history');
    l.push('demographics', 'insights');
    if (election.type === 'LS') l.push('states');
    return l;
  }, [swing.size, dominance.size, election.type]);

  return {
    election, data, swing, dominance, incumbency, partySwitches, marginTrend: ha.marginTrend, prevYear,
    totalSeats, majority, votePct, ticker, recentSeats, sseConnected, availableLayers,
  };
}
