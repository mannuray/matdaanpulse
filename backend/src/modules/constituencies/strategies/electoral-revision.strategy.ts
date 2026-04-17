import { AnalysisStrategy, AnalysisContext } from './analysis-strategy.interface';

export class ElectoralRevisionStrategy implements AnalysisStrategy {
  name = 'revision';

  execute(context: AnalysisContext) {
    const { constId, constNo, electionId, manifest, winnersByElection } = context;
    const revisionData = (manifest?.revision || {}) as Record<string, { pre: number; post: number }>;
    const revisionLabel = (manifest as any)?.revision_label || '';
    
    const revision: any = {};
    const rev = revisionData[String(constNo)] || revisionData[constId];

    if (rev) {
      revision.pre = rev.pre;
      revision.post = rev.post;
      revision.label = revisionLabel;
      revision.net_change = rev.post - rev.pre;
      revision.pct_change = rev.pre > 0 ? ((rev.post - rev.pre) / rev.pre) * 100 : 0;

      const currWinner = winnersByElection.get(electionId)?.get(constNo);
      if (currWinner && currWinner.margin > 0) {
        const ratio = Math.abs(rev.post - rev.pre) / currWinner.margin;
        revision.margin_ratio = ratio;
        revision.impact = ratio > 1 ? 'High' : ratio >= 0.5 ? 'Moderate' : 'Low';
      }
    }

    return { revision };
  }
}
