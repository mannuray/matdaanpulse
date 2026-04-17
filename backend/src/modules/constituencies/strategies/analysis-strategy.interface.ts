export interface AnalysisContext {
  constId: string;
  constNo: string;
  electionId: string;
  historyElectionIds: string[];
  electionYearMap: Map<string, number>;
  winnersByElection: Map<string, Map<string, any>>;
  resultsByConst: Map<string, any[]>;
  candidatesByElectionConst: Map<string, Map<string, any[]>>;
  manifest: any;
}

export interface AnalysisStrategy {
  name: string;
  execute(context: AnalysisContext): any;
}
