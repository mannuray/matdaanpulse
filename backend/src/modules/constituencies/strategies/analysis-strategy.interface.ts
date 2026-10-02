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
}

export interface AnalysisStrategy {
  name: string;
  execute(context: AnalysisContext): any;
}
