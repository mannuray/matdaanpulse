import { AnalysisStrategy, AnalysisContext } from './analysis-strategy.interface';

export class SwingAnalysisStrategy implements AnalysisStrategy {
  name = 'swing';

  execute(context: AnalysisContext) {
    const { constNo, historyElectionIds, electionId, winnersByElection } = context;
    const swing: any = {};

    if (historyElectionIds.length > 0) {
      const prevEid = historyElectionIds[historyElectionIds.length - 1];
      const prevWinner = winnersByElection.get(prevEid)?.get(constNo);
      const currWinner = winnersByElection.get(electionId)?.get(constNo);

      if (prevWinner && currWinner) {
        swing.prev_party = prevWinner.party_id;
        swing.curr_party = currWinner.party_id;
        swing.flipped = prevWinner.party_id !== currWinner.party_id;
        swing.margin = currWinner.margin;
      }
    }

    return { swing };
  }
}
