import { useMemo } from 'react';
import { normalizeConstId } from '../../model/geo/normalizeConstId';
import {
  calculateDominance,
  calculateIncumbency,
  calculatePartySwitches,
  calculateMarginTrend,
  calculatePartyTrend
} from '../../model/derive/intelligence';
import { RAW_COMPARER, type PartyComparer } from '../../model/derive/partyComparer';
import type {
  ResultRow, DominanceEntry, IncumbencyEntry,
  PartySwitchEntry, MarginTrendPoint, PartyTrendPoint, SwingEntry,
} from '../../model/types';

interface UseHistoryAnalysisParams {
  allHistResults: ResultRow[][] | null;
  prevResults: ResultRow[] | null;
  results: ResultRow[] | null;
  currentWinnerMap: Map<string, ResultRow>;
  allConstIds?: string[];
  historyYears: number[];
  currentYear: number;
  /** Party lineage (renames, mergers, splits); plain id equality when absent. */
  cmp?: PartyComparer;
}

interface UseHistoryAnalysisResult {
  dominanceMap: Map<string, DominanceEntry>;
  incumbencyData: IncumbencyEntry[];
  partySwitchData: PartySwitchEntry[];
  marginTrend: MarginTrendPoint[];
  partyTrend: PartyTrendPoint[];
  swingMap: Map<string, SwingEntry>;
}

/** Seat-level swing vs the previous election (matched via normalized const id). */
export function calculateSwing(
  prevResults: ResultRow[] | null,
  currentWinnerMap: Map<string, ResultRow>,
  lineage: { cmp: PartyComparer; fromYear: number; toYear: number } = { cmp: RAW_COMPARER, fromYear: 0, toYear: 0 },
): Map<string, SwingEntry> {
  const out = new Map<string, SwingEntry>();
  if (!prevResults || prevResults.length === 0) return out;
  const prevWinners = new Map<string, ResultRow>();
  for (const r of prevResults) {
    if (r.status !== 'WON' && r.status !== 'LEADING') continue;
    const key = normalizeConstId(r.const_id);
    const existing = prevWinners.get(key);
    if (!existing || r.votes > existing.votes) prevWinners.set(key, r);
  }
  for (const [constId, cur] of currentWinnerMap) {
    const prev = prevWinners.get(normalizeConstId(constId));
    if (!prev) continue;
    const rel = lineage.cmp.relation(prev.party_id, cur.party_id, lineage.fromYear, lineage.toYear);
    out.set(constId, {
      constId,
      currentParty: cur.party_id,
      prevParty: prev.party_id,
      currentMargin: Number(cur.margin) || 0,
      prevMargin: Number(prev.margin) || 0,
      flipped: rel === 'different',
      split: rel === 'split',
    });
  }
  return out;
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
  cmp = RAW_COMPARER,
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
    calculateDominance(allHistResults, currentWinnerMap, normToConstId, { cmp, years: historyYears, currentYear }),
    [allHistResults, currentWinnerMap, normToConstId, cmp, historyYears, currentYear]
  );

  const incumbencyData = useMemo(() => 
    calculateIncumbency(prevResults, results, normToConstId),
    [prevResults, results, normToConstId]
  );

  const partySwitchData = useMemo(() => 
    calculatePartySwitches(allElections, normToConstId, cmp),
    [allElections, normToConstId, cmp]
  );

  const marginTrend = useMemo(() => 
    calculateMarginTrend(allElections),
    [allElections]
  );

  const partyTrend = useMemo(() => 
    calculatePartyTrend(allElections, cmp),
    [allElections, cmp]
  );

  const swingMap = useMemo(
    () => calculateSwing(prevResults, currentWinnerMap, { cmp, fromYear: historyYears[historyYears.length - 1] ?? 0, toYear: currentYear }),
    [prevResults, currentWinnerMap, cmp, historyYears, currentYear]
  );

  return { dominanceMap, incumbencyData, partySwitchData, marginTrend, partyTrend, swingMap };
}
