import { AnalysisStrategy, AnalysisContext } from './analysis-strategy.interface';

export class SpoilerDetectionStrategy implements AnalysisStrategy {
  name = 'spoiler';

  execute(context: AnalysisContext) {
    const { constId, resultsByConst, manifest } = context;
    const voteSplits = (manifest?.vote_splits || []) as any[];
    const manifestAlliances = (manifest?.alliances || []) as any[];
    const alliancePartyMap = new Map<string, Set<string>>(manifestAlliances.map(ma => [ma.id, new Set(ma.parties)]));

    const constResults = resultsByConst.get(constId) || [];
    let spoiler: any;

    if (voteSplits?.length && constResults.length >= 2) {
      const winnerMargin = constResults[0].votes - constResults[1].votes;
      for (const vs of voteSplits) {
        const cand = constResults.find(r => r.party_id === vs.spoiler);
        // If spoiler cand exists AND winner is not part of the alliance being hurt AND spoiler votes > margin
        if (cand && (!alliancePartyMap.get(vs.hurts)?.has(constResults[0].party_id)) && cand.votes > winnerMargin) {
          spoiler = {
            spoiler_party: vs.spoiler,
            spoiler_votes: cand.votes,
            winner_margin: winnerMargin,
            hurts_alliance: vs.hurts,
            label: vs.label
          };
          break;
        }
      }
    }

    return { spoiler };
  }
}
