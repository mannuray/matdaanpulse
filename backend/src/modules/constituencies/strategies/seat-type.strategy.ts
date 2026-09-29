import { AnalysisStrategy, AnalysisContext } from './analysis-strategy.interface';

export class SeatTypeStrategy implements AnalysisStrategy {
  name = 'seatType';

  execute(context: AnalysisContext) {
    const { constId, resultsByConst } = context;
    const constResults = resultsByConst.get(constId) || [];
    let seat_type: string | null = null;

    if (constResults.length >= 2) {
      const totalVotes = constResults.reduce((s, r) => s + r.votes, 0);
      if (totalVotes > 0) {
        const shares = constResults.map(r => (r.votes / totalVotes) * 100);
        const third = shares[2] || 0;
        const above10 = shares.filter(s => s >= 10).length;

        // Frontend only renders two-way / three-way / multi-cornered; anything
        // without ≥3 candidates above 10% is treated as a two-way contest.
        if (above10 >= 3) {
          seat_type = third >= 15 ? 'three-way' : 'multi-cornered';
        } else {
          seat_type = 'two-way';
        }
      }
    }

    return { seat_type };
  }
}
