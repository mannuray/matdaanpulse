import { AnalysisStrategy, AnalysisContext } from './analysis-strategy.interface';

export class SeatHistoryStrategy implements AnalysisStrategy {
  name = 'history';

  execute(context: AnalysisContext) {
    const { constNo, historyElectionIds, electionId, winnersByElection, electionYearMap } = context;
    const allElectionIds = [...historyElectionIds, electionId];

    const seat_history = allElectionIds.map(eid => {
      const w = winnersByElection.get(eid)?.get(constNo);
      if (!w) return null;
      return {
        year: electionYearMap.get(eid) || 0,
        party: w.party_id,
        candidate: w.candidate_name,
        margin: w.margin
      };
    }).filter(Boolean);

    return { seat_history };
  }
}
