import { useMemo } from 'react';
import { useApi } from './useApi';
import { getAnalysis } from '../services/api';
import type {
  DominanceEntry, IncumbencyEntry,
  PartySwitchEntry, SwingEntry,
} from '../types';

interface UseAnalysisResult {
  dominanceMap: Map<string, DominanceEntry>;
  incumbencyData: IncumbencyEntry[];
  partySwitchData: PartySwitchEntry[];
  swingMap: Map<string, SwingEntry>;
  spoilerMap: Map<string, { spoilerParty: string; spoilerVotes: number; winnerMargin: number; hurtsAlliance: string }>;
  seatTypeMap: Map<string, 'two-way' | 'three-way' | 'multi-cornered'>;
  loading: boolean;
}

export function useAnalysis(electionId: string | undefined): UseAnalysisResult {
  const { data: analysisData, loading } = useApi(
    () => electionId ? getAnalysis(electionId) : Promise.resolve(null),
    [electionId]
  );

  const dominanceMap = useMemo(() => {
    const map = new Map<string, DominanceEntry>();
    if (!analysisData) return map;
    for (const a of analysisData) {
      if (!a.dominance) continue;
      const inc = a.incumbency || {};
      const seatHistory = (inc.seat_history as Array<{ party: string }>) || [];
      const winners = seatHistory.map(h => ({ party: h.party }));
      const classification = a.dominance as DominanceEntry['classification'];
      const dominanceWins = (inc.dominance_wins as number) || 0;
      map.set(a.const_id, {
        constId: a.const_id,
        winners,
        classification,
        dominantParty: a.dominance_party || undefined,
        streak: dominanceWins,
      });
    }
    return map;
  }, [analysisData]);

  const incumbencyData = useMemo((): IncumbencyEntry[] => {
    if (!analysisData) return [];
    const entries: IncumbencyEntry[] = [];
    for (const a of analysisData) {
      const inc = a.incumbency || {};
      if (inc.incumbent_name) {
        entries.push({
          constId: a.const_id,
          incumbentName: inc.incumbent_name as string,
          incumbentParty: inc.incumbent_party as string,
          won: !!inc.won,
          currentMargin: 0,
        });
      }
    }
    return entries;
  }, [analysisData]);

  const partySwitchData = useMemo((): PartySwitchEntry[] => {
    if (!analysisData) return [];
    const entries: PartySwitchEntry[] = [];
    for (const a of analysisData) {
      const switchers = (a.incumbency?.party_switchers as Array<{
        candidate_name: string; from_party: string; to_party: string;
        from_year: number; to_year: number; won_in_new: boolean; margin: number;
      }>) || [];
      for (const s of switchers) {
        entries.push({
          constId: a.const_id,
          candidateName: s.candidate_name,
          fromParty: s.from_party,
          toParty: s.to_party,
          fromYear: s.from_year,
          toYear: s.to_year,
          wonInNewParty: s.won_in_new,
          margin: s.margin,
        });
      }
    }
    return entries;
  }, [analysisData]);

  const swingMap = useMemo(() => {
    const map = new Map<string, SwingEntry>();
    if (!analysisData) return map;
    for (const a of analysisData) {
      const swing = a.incumbency?.swing as { prev_party?: string; curr_party?: string; flipped?: boolean; margin?: number } | undefined;
      if (!swing?.prev_party || !swing?.curr_party) continue;
      map.set(a.const_id, {
        constId: a.const_id,
        currentParty: swing.curr_party,
        prevParty: swing.prev_party,
        currentMargin: swing.margin || 0,
        prevMargin: 0,
        flipped: !!swing.flipped,
      });
    }
    return map;
  }, [analysisData]);

  const spoilerMap = useMemo(() => {
    const map = new Map<string, { spoilerParty: string; spoilerVotes: number; winnerMargin: number; hurtsAlliance: string }>();
    if (!analysisData) return map;
    for (const a of analysisData) {
      const sp = a.incumbency?.spoiler as { spoiler_party?: string; spoiler_votes?: number; winner_margin?: number; hurts_alliance?: string; label?: string } | undefined;
      if (!sp?.spoiler_party) continue;
      map.set(a.const_id, {
        spoilerParty: sp.label || sp.spoiler_party,
        spoilerVotes: sp.spoiler_votes || 0,
        winnerMargin: sp.winner_margin || 0,
        hurtsAlliance: sp.hurts_alliance || '',
      });
    }
    return map;
  }, [analysisData]);

  const seatTypeMap = useMemo(() => {
    const map = new Map<string, 'two-way' | 'three-way' | 'multi-cornered'>();
    if (!analysisData) return map;
    for (const a of analysisData) {
      const st = a.incumbency?.seat_type as string | undefined;
      if (st === 'two-way' || st === 'three-way' || st === 'multi-cornered') {
        map.set(a.const_id, st);
      }
    }
    return map;
  }, [analysisData]);

  return { dominanceMap, incumbencyData, partySwitchData, swingMap, spoilerMap, seatTypeMap, loading };
}
