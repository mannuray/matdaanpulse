import { AnalysisStrategy, AnalysisContext } from './analysis-strategy.interface';

export class DominanceStrategy implements AnalysisStrategy {
  name = 'dominance';

  execute(context: AnalysisContext) {
    const { constNo, historyElectionIds, electionId, winnersByElection } = context;
    const allElectionIds = [...historyElectionIds, electionId];
    
    const partyWins = new Map<string, number>();
    const winnerList: any[] = [];

    for (const eid of allElectionIds) {
      // Find winner for this constNo in this election
      const winner = context.winnersByElection.get(eid)?.get(constNo);
      if (winner) {
        partyWins.set(winner.party_id, (partyWins.get(winner.party_id) || 0) + 1);
        winnerList.push({ party: winner.party_id, election_id: eid });
      }
    }

    const totalElections = winnerList.length;
    let dominance = 'new';
    let dominanceParty: string | null = null;
    let dominanceWins = 0;

    if (partyWins.size > 0) {
      const sorted = [...partyWins.entries()].sort((a, b) => b[1] - a[1]);
      const [topParty, topWins] = sorted[0];
      dominanceWins = topWins;
      
      if (topWins >= 3 || (totalElections <= 3 && topWins === totalElections)) {
        dominance = 'stronghold';
        dominanceParty = topParty;
      } else if (topWins >= 2) {
        dominance = 'loyal';
        dominanceParty = topParty;
      } else {
        dominance = 'swing';
      }
    }

    return {
      dominance,
      dominance_party: dominanceParty,
      dominance_wins: dominanceWins,
      dominance_total: totalElections,
    };
  }
}
