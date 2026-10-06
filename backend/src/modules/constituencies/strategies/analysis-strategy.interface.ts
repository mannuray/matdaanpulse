import type { CompareContext, LineageEventLike } from '../../../common/comparable-parties';

/** Per election and seat (const_no): total votes cast and the second-placed candidate. */
export interface SeatStats {
  total: number;
  runnerUp: { name: string; party_id: string | null } | null;
}

export interface AnalysisContext {
  constId: string;
  constNo: string;
  electionId: string;
  historyElectionIds: string[];
  electionYearMap: Map<string, number>;
  winnersByElection: Map<string, Map<string, any>>;
  resultsByConst: Map<string, any[]>;
  candidatesByElectionConst: Map<string, Map<string, any[]>>;
  /** election id → const_no → totals (seat history: winner share, runner-up). */
  seatStatsByElection: Map<string, Map<string, SeatStats>>;
  manifest: any;
  /** Party lineage events (renames, mergers, splits) and what comparisons need to apply them (migration 023). */
  lineage?: LineageEventLike[];
  /** election id → counting date (YYYY-MM-DD); missing → mid-year of its year. */
  electionDateMap?: Map<string, string>;
  stateId?: number | null;
}

/** The comparison window between two elections of this context (for the party lineage rule). */
export function compareWindow(ctx: AnalysisContext, fromEid: string, toEid: string): CompareContext {
  const date = (eid: string) => ctx.electionDateMap?.get(eid) ?? `${ctx.electionYearMap?.get(eid) ?? 1900}-07-01`;
  return { fromDate: date(fromEid), toDate: date(toEid), stateId: ctx.stateId ?? null };
}

export interface AnalysisStrategy {
  name: string;
  execute(context: AnalysisContext): any;
}
