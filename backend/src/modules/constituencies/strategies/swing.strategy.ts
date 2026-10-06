import { AnalysisStrategy, AnalysisContext, compareWindow } from './analysis-strategy.interface';
import { relation } from '../../../common/comparable-parties';

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
        // Party lineage: a rename/merger is the same party; a split faction holding an old-party seat is `split`, not a flip.
        const rel = relation(context.lineage ?? [], prevWinner.party_id, currWinner.party_id, compareWindow(context, prevEid, electionId));
        swing.flipped = rel === 'different';
        swing.split = rel === 'split';
        swing.margin = currWinner.margin;
      }
    }

    return { swing };
  }
}
