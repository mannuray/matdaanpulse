import { AnalysisStrategy, AnalysisContext } from './analysis-strategy.interface';

export class SeatHistoryStrategy implements AnalysisStrategy {
  name = 'history';

  execute(context: AnalysisContext) {
    const { constNo, historyElectionIds, electionId, winnersByElection, electionYearMap, seatStatsByElection } = context;
    const allElectionIds = [...historyElectionIds, electionId];

    const seat_history = allElectionIds.map(eid => {
      const w = winnersByElection.get(eid)?.get(constNo);
      if (!w) return null;
      const stats = seatStatsByElection.get(eid)?.get(constNo);
      const total = stats?.total ?? 0;
      return {
        year: electionYearMap.get(eid) || 0,
        party: w.party_id,
        candidate: w.candidate_name,
        margin: w.margin,
        vote_share: total > 0 ? Math.round(((w.votes ?? 0) / total) * 1000) / 10 : null,
        runner_up: stats?.runnerUp?.name ?? null,
        runner_up_party: stats?.runnerUp?.party_id ?? null,
      };
    }).filter(Boolean);

    return { seat_history };
  }
}
