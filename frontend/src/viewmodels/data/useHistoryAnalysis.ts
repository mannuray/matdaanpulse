import { useMemo } from 'react';
import { calculateMarginTrend, calculatePartyTrend } from '../../model/derive/intelligence';
import { RAW_COMPARER, type PartyComparer } from '../../model/derive/partyComparer';
import type { ResultRow, MarginTrendPoint, PartyTrendPoint } from '../../model/types';

interface UseHistoryAnalysisParams {
  allHistResults: ResultRow[][] | null;
  results: ResultRow[] | null;
  historyYears: number[];
  currentYear: number;
  /** Party lineage (renames, mergers, splits); plain id equality when absent. */
  cmp?: PartyComparer;
}

interface UseHistoryAnalysisResult {
  marginTrend: MarginTrendPoint[];
  partyTrend: PartyTrendPoint[];
}

/**
 * The historical trend charts (margins and party seats over the comparable elections). Seat-level analysis (swing,
 * dominance, incumbency, switchers) comes from the shared seat-analysis module: stored for Finalized elections,
 * baseline + live analysis otherwise (seat analysis Phase B).
 */
export function useHistoryAnalysis({ allHistResults, results, historyYears, currentYear, cmp = RAW_COMPARER }: UseHistoryAnalysisParams): UseHistoryAnalysisResult {
  const allElections = useMemo(() => {
    if (!allHistResults || !results || !currentYear) return null;
    const elections: { results: ResultRow[]; year: number }[] = [];
    for (let i = 0; i < allHistResults.length; i++) elections.push({ results: allHistResults[i], year: historyYears[i] || 0 });
    elections.push({ results, year: currentYear });
    return elections;
  }, [allHistResults, results, currentYear, historyYears]);

  const marginTrend = useMemo(() => calculateMarginTrend(allElections), [allElections]);
  const partyTrend = useMemo(() => calculatePartyTrend(allElections, cmp), [allElections, cmp]);
  return { marginTrend, partyTrend };
}
