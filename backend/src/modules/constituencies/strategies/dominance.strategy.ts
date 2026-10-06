import { AnalysisStrategy, AnalysisContext, compareWindow } from './analysis-strategy.interface';
import { carryForward } from '../../../common/comparable-parties';

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
        // Each past winner counts as the party it became by this election (renames, mergers, a split's successor).
        const w = compareWindow(context, eid, electionId);
        const party = eid === electionId ? winner.party_id : carryForward(context.lineage ?? [], winner.party_id, w.fromDate, w.toDate, w.stateId);
        partyWins.set(party, (partyWins.get(party) || 0) + 1);
        winnerList.push({ party, election_id: eid });
      }
    }

    const totalElections = winnerList.length;
    let dominance = 'new';
    let dominanceParty: string | null = null;
    let dominanceWins = 0;

    // No comparable past result (a first election, or the first after a redraw): a new seat, whatever this
    // election's result. One win out of one election is not a stronghold.
    const hasHistory = winnerList.some(w => w.election_id !== electionId);
    if (partyWins.size > 0 && hasHistory) {
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
