import { AnalysisStrategy, AnalysisContext } from './analysis-strategy.interface';

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
          if (match.party_id !== prevWinner.party_id) incumbency.switched_to = match.party_id;
          
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
