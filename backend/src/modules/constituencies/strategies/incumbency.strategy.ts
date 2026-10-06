import { AnalysisStrategy, AnalysisContext, compareWindow } from './analysis-strategy.interface';
import { relation } from '../../../common/comparable-parties';

export class IncumbencyStrategy implements AnalysisStrategy {
  name = 'incumbency';

  private normName(n: string) {
    return n.toUpperCase().trim().replace(/\s+ALIAS\s+.*/i, '').replace(/[^A-Z\s]/g, '').trim();
  }

  execute(context: AnalysisContext) {
    const { constId, constNo, historyElectionIds, electionId, winnersByElection, candidatesByElectionConst } = context;
    const incumbency: any = {};

    if (historyElectionIds.length > 0) {
      const prevEid = historyElectionIds[historyElectionIds.length - 1];
      const prevWinner = winnersByElection.get(prevEid)?.get(constNo);

      if (prevWinner) {
        incumbency.incumbent_name = prevWinner.candidate_name;
        incumbency.incumbent_party = prevWinner.party_id;

        const constCands = candidatesByElectionConst.get(electionId)?.get(constId) || [];
        const match = constCands.find(c => this.normName(c.name) === this.normName(prevWinner.candidate_name));

        if (match) {
          incumbency.re_contesting = true;
          // Following the party through a rename/merger is no switch; going with a split faction is recorded as such.
          const rel = relation(context.lineage ?? [], prevWinner.party_id, match.party_id, compareWindow(context, prevEid, electionId));
          if (rel === 'different') incumbency.switched_to = match.party_id;
          else if (rel === 'split') incumbency.followed_split = match.party_id;
          
          const currWinner = winnersByElection.get(electionId)?.get(constNo);
          if (currWinner) {
            incumbency.won = this.normName(currWinner.candidate_name) === this.normName(prevWinner.candidate_name);
          }
        } else {
          incumbency.re_contesting = false;
        }
      }
    }

    return { incumbency };
  }
}
