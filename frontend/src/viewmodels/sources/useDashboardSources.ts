import { majorityOf } from '../../model/derive/majority';
import { usePartyComparer } from '../data/usePartyComparer';
import { useCallback, useEffect, useMemo } from 'react';
import { useDashboardData } from '../data/useDashboardData';
import { useHistoryAnalysis } from '../data/useHistoryAnalysis';
import { useHistoricalResults } from '../data/useHistoricalResults';
import { useAnalysis } from '../data/useAnalysis';
import { useBaseline } from '../data/useBaseline';
import { useLiveAnalysis } from '../data/useLiveAnalysis';
import { liveMaps, prevYearOf } from '../../model/derive/liveMaps';
import type { SeatLive, LiveTally, SeatBaseline } from '../../model/derive/seatAnalysis';
import { useElection } from '../data/useElection';
import { useLocalStorage } from '../data/useLocalStorage';
import { usePartyMeta } from '../data/usePartyMeta';
import type { CustomWatch } from '../../model/derive/leaders';
import type { PartyMeta } from '../../model/derive/partyMeta';
import type { Election, SwingEntry, DominanceEntry, IncumbencyEntry, PartySwitchEntry, MarginTrendPoint, PartyTrendPoint } from '../../model/types';
import type { LayerId } from '../../model/types/dashboard';
import type { DashboardViewModel } from '../data/useDashboardData';

const EMPTY_YEARS: number[] = [];
const EMPTY_WATCH: CustomWatch[] = [];
const EMPTY_MAPS: { swing: Map<string, SwingEntry>; dominance: Map<string, DominanceEntry>; incumbency: IncumbencyEntry[]; partySwitches: PartySwitchEntry[] } = { swing: new Map(), dominance: new Map(), incumbency: [], partySwitches: [] };

export interface DashboardSources {
  election: Election;
  data: DashboardViewModel;
  swing: Map<string, SwingEntry>;
  dominance: Map<string, DominanceEntry>;
  incumbency: IncumbencyEntry[];
  partySwitches: PartySwitchEntry[];
  marginTrend: MarginTrendPoint[];
  partyTrend: PartyTrendPoint[];
  /** Every party id in this state's past comparable results, as recorded (not lineage-adjusted). */
  historyPartyIds: Set<string>;
  prevYear: number | null;
  totalSeats: number;
  /** null: no majority line (part of a larger assembly). */
  majority: number | null;
  votePct: Map<string, number>;
  /** Live election: the last poll succeeded. */
  liveConnected: boolean;
  availableLayers: LayerId[];
  /** Live / upcoming election: each seat's pre-counting baseline (names behind upsets in the seat dialog); null without one. */
  baselineSeats: Map<string, SeatBaseline> | null;
  /** Live / upcoming election: per-seat live state and live tallies (null without a baseline). For the map work. */
  liveAnalysis: { seats: Map<string, SeatLive>; tally: LiveTally } | null;
  /** Party abbreviation and mark (logo → ECI symbol) by party id. */
  partyMeta: Map<string, PartyMeta>;
  /** The user's own tracked seats (shared by the seat panel and the watchlist tab). */
  watchlist: CustomWatch[];
  addWatch(constId: string, label: string): void;
  removeWatch(constId: string): void;
}

export function useDashboardSources(pageElection: Election): DashboardSources {
  const data = useDashboardData(pageElection);
  const { setLiveConnected } = useElection();
  const partyMeta = usePartyMeta();
  const { manifestData, results, mapRegions, voteShare, liveConnected, liveStatus } = data;
  // The election as the tiles should see it: its status follows /live (Upcoming → Live → Finalized
  // without a reload).
  const election = useMemo(
    () => (liveStatus && liveStatus !== pageElection.status ? { ...pageElection, status: liveStatus } : pageElection),
    [pageElection, liveStatus],
  );

  const historyResults = useHistoricalResults(manifestData?.history);
  const historyPartyIds = useMemo(() => new Set((historyResults ?? []).flat().map(r => r.party_id)), [historyResults]);
  const cmp = usePartyComparer(election.state_id, election.type);
  const ha = useHistoryAnalysis({
    results, allHistResults: historyResults, historyYears: manifestData?.history_years || EMPTY_YEARS, currentYear: election.year, cmp,
  });
  // Seat maps: the stored analysis once Finalized; before that the baseline + live analysis (one engine: seat analysis Phase B).
  const notFinal = election.status !== 'Finalized';
  const ba = useAnalysis(notFinal ? undefined : election.id);
  const baseline = useBaseline(election.id, notFinal);
  const liveAnalysis = useLiveAnalysis(baseline, results, data.seats, data.trails);
  const baselineSeats = useMemo(() => (baseline ? new Map(baseline.seats.map(s => [s.const_id, s])) : null), [baseline]);
  const lm = useMemo(() => (baseline ? liveMaps(baseline, liveAnalysis ? [...liveAnalysis.seats.values()] : [], election.year) : null), [baseline, liveAnalysis, election.year]);
  const src = !notFinal ? { swing: ba.swingMap, dominance: ba.dominanceMap, incumbency: ba.incumbencyData, partySwitches: ba.partySwitchData } : lm ?? EMPTY_MAPS;
  const { swing, dominance, incumbency, partySwitches } = src;
  const prevYear = prevYearOf(notFinal ? baseline : null, manifestData?.history_years ?? EMPTY_YEARS);

  const totalSeats = election.type === 'LS' ? (mapRegions.length || 543) : (election.state?.total_assembly_seats || mapRegions.length);
  const majority = majorityOf(manifestData, totalSeats);
  const votePct = useMemo(() => new Map(voteShare.map(v => [v.party_id, Number(v.percentage)])), [voteShare]);

  useEffect(() => { setLiveConnected(liveConnected); }, [liveConnected, setLiveConnected]);
  // Leaving the dashboard: the legacy header must not keep showing a stale "connected".
  useEffect(() => () => setLiveConnected(false), [setLiveConnected]);

  const availableLayers = useMemo((): LayerId[] => {
    const l: LayerId[] = ['overview', 'battle'];
    if (swing.size > 0) l.push('swing');
    if (dominance.size > 0) l.push('history');
    // Regions: every Vidhan Sabha election (its seats carry regions; the layer shows an empty summary otherwise).
    if (election.type === 'VS') l.push('regions');
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

  // One object per data change (the live pulse lives in its own context): tile VMs memoised on it skip their work between polls.
  return useMemo(() => ({
    election, data, swing, dominance, incumbency, partySwitches, marginTrend: ha.marginTrend, partyTrend: ha.partyTrend, historyPartyIds, prevYear,
    totalSeats, majority, votePct, liveConnected, availableLayers, partyMeta, liveAnalysis, baselineSeats,
    watchlist, addWatch, removeWatch,
  }), [election, data, swing, dominance, incumbency, partySwitches, ha.marginTrend, ha.partyTrend, historyPartyIds, prevYear,
    totalSeats, majority, votePct, liveConnected, availableLayers, partyMeta, liveAnalysis, baselineSeats, watchlist, addWatch, removeWatch]);
}
