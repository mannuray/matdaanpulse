import { useMemo } from 'react';
import { normalizeConstId } from '../utils/normalizeConstId';
import {
  calculateDominance,
  calculateIncumbency,
  calculatePartySwitches,
  calculateMarginTrend,
  calculatePartyTrend
} from '../services/intelligence.service';
import type {
  ResultRow, DominanceEntry, IncumbencyEntry,
  PartySwitchEntry, MarginTrendPoint, PartyTrendPoint,
} from '../types';

interface UseHistoryAnalysisParams {
  allHistResults: ResultRow[][] | null;
  prevResults: ResultRow[] | null;
  results: ResultRow[] | null;
  currentWinnerMap: Map<string, ResultRow>;
  allConstIds?: string[];
  historyYears: number[];
  currentYear: number;
}

interface UseHistoryAnalysisResult {
  dominanceMap: Map<string, DominanceEntry>;
  incumbencyData: IncumbencyEntry[];
  partySwitchData: PartySwitchEntry[];
  marginTrend: MarginTrendPoint[];
  partyTrend: PartyTrendPoint[];
}

/**
 * HOOK: useHistoryAnalysis (MVC: Controller)
 * Orchestrates election analysis by delegating complex logic to IntelligenceService.
 */
export function useHistoryAnalysis({
  allHistResults,
  prevResults,
  results,
  currentWinnerMap,
  allConstIds,
  historyYears,
  currentYear,
}: UseHistoryAnalysisParams): UseHistoryAnalysisResult {
  
  // 1. Prepare Normalization Mapping
  const normToConstId = useMemo(() => {
    const map = new Map<string, string>();
    const ids = allConstIds && allConstIds.length > 0 ? allConstIds : [...currentWinnerMap.keys()];
    for (const id of ids) {
      map.set(normalizeConstId(id), id);
    }
    return map;
  }, [allConstIds, currentWinnerMap]);

  // 2. Aggregate Election Data
  const allElections = useMemo(() => {
    if (!allHistResults || !results || !currentYear) return null;
    const elections: { results: ResultRow[]; year: number }[] = [];
    for (let i = 0; i < allHistResults.length; i++) {
      elections.push({ results: allHistResults[i], year: historyYears[i] || 0 });
    }
    elections.push({ results, year: currentYear });
    return elections;
  }, [allHistResults, results, currentYear, historyYears]);

  // 3. Delegate Logic to Service Layer
  const dominanceMap = useMemo(() => 
    calculateDominance(allHistResults, currentWinnerMap, normToConstId),
    [allHistResults, currentWinnerMap, normToConstId]
  );

  const incumbencyData = useMemo(() => 
    calculateIncumbency(prevResults, results, normToConstId),
    [prevResults, results, normToConstId]
  );

  const partySwitchData = useMemo(() => 
    calculatePartySwitches(allElections, normToConstId),
    [allElections, normToConstId]
  );

  const marginTrend = useMemo(() => 
    calculateMarginTrend(allElections),
    [allElections]
  );

  const partyTrend = useMemo(() => 
    calculatePartyTrend(allElections),
    [allElections]
  );

  return { dominanceMap, incumbencyData, partySwitchData, marginTrend, partyTrend };
}
