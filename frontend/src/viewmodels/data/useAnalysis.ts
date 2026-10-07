import { useMemo } from 'react';
import { useApi } from './useApi';
import { getAnalysis } from '../../model/api/api';
import type {
  AnalysisEntry, DominanceEntry, IncumbencyEntry,
  PartySwitchEntry, SwingEntry,
} from '../../model/types';

interface UseAnalysisResult {
  dominanceMap: Map<string, DominanceEntry>;
  incumbencyData: IncumbencyEntry[];
  partySwitchData: PartySwitchEntry[];
  swingMap: Map<string, SwingEntry>;
  spoilerMap: Map<string, { spoilerParty: string; spoilerVotes: number; winnerMargin: number; hurtsAlliance: string }>;
  seatTypeMap: Map<string, 'two-way' | 'three-way' | 'multi-cornered'>;
  loading: boolean;
}

/** The stored seat analysis (`data`) as the dashboard's maps; rows without `data` are skipped. */
export function mapAnalysis(rows: AnalysisEntry[] | null) {
  const dominanceMap = new Map<string, DominanceEntry>();
  const swingMap = new Map<string, SwingEntry>();
  const spoilerMap = new Map<string, { spoilerParty: string; spoilerVotes: number; winnerMargin: number; hurtsAlliance: string }>();
  const seatTypeMap = new Map<string, 'two-way' | 'three-way' | 'multi-cornered'>();
  const incumbencyData: IncumbencyEntry[] = [];
  const partySwitchData: PartySwitchEntry[] = [];
  for (const a of rows ?? []) {
    const d = a.data;
    if (!d) continue;
    const id = a.const_id;
    const year = d.history[d.history.length - 1]?.year ?? 0;
    if (d.class) dominanceMap.set(id, { constId: id, winners: d.history.map(h => ({ party: h.party ?? '' })), classification: d.class.kind, dominantParty: d.class.holder, streak: d.class.streak });
    if (d.outcome && d.outcome.kind !== 'new' && d.winner?.party_id && d.outcome.from_raw) {
      swingMap.set(id, { constId: id, currentParty: d.winner.party_id, prevParty: d.outcome.from_raw, currentMargin: d.margin ?? 0,
        prevMargin: d.history[d.history.length - 2]?.margin ?? 0, flipped: d.outcome.kind === 'gained', split: d.outcome.kind === 'split' });
    }
    if (d.incumbent) incumbencyData.push({ constId: id, incumbentName: d.incumbent.name, incumbentParty: d.incumbent.party ?? '', won: !!d.incumbent.won, currentMargin: d.margin ?? 0 });
    for (const n of d.notes) {
      if (n.kind === 'switcher') partySwitchData.push({ constId: id, candidateName: n.name, fromParty: n.from, toParty: n.to, fromYear: n.year, toYear: year, wonInNewParty: d.winner?.name === n.name, margin: d.margin ?? 0 });
      if (n.kind === 'spoiler' && n.hurts) spoilerMap.set(id, { spoilerParty: n.label || n.party || n.name, spoilerVotes: n.votes, winnerMargin: n.margin, hurtsAlliance: n.hurts });
    }
    if (d.seat_type) seatTypeMap.set(id, d.seat_type);
  }
  return { dominanceMap, incumbencyData, partySwitchData, swingMap, spoilerMap, seatTypeMap };
}

export function useAnalysis(electionId: string | undefined): UseAnalysisResult {
  const { data: analysisData, loading } = useApi(
    () => electionId ? getAnalysis(electionId) : Promise.resolve(null),
    [electionId]
  );
  const maps = useMemo(() => mapAnalysis(analysisData), [analysisData]);
  return { ...maps, loading };
}
