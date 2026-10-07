import { legacyIncumbency } from './legacy-analysis';

describe('legacy analysis adapter (one release)', () => {
  it('maps SeatAnalysis to the old incumbency JSON', () => {
    const data: any = {
      winner: { party_id: 'BJP', name: 'R' }, margin: 500, seat_type: 'two-way',
      outcome: { kind: 'gained', from: 'RJD', from_raw: 'RJD' },
      class: { kind: 'swing', holder: 'BJP', streak: 1, since: 2025, wins: 1, total: 4 },
      incumbent: { name: 'S', party: 'RJD', recontested: true, switched: false, followed_split: false, won: false, party_now: 'RJD' },
      history: [{ year: 2020, party: 'RJD', candidate: 'S', margin: 10, vote_share: 40, runner_up: 'R', runner_up_party: 'BJP' }],
      notes: [{ kind: 'spoiler', name: 'C', party: 'AIMIM', votes: 900, margin: 500, hurts: 'MGB', label: 'AIMIM split' }],
    };
    expect(legacyIncumbency(data)).toEqual({
      incumbent_name: 'S', incumbent_party: 'RJD', re_contesting: true, won: false,
      swing: { prev_party: 'RJD', curr_party: 'BJP', flipped: true, split: false, margin: 500 },
      seat_type: 'two-way', dominance_wins: 1, dominance_total: 4,
      seat_history: [{ year: 2020, party: 'RJD', candidate: 'S', margin: 10, vote_share: 40, runner_up: 'R', runner_up_party: 'BJP' }],
      spoiler: { spoiler_party: 'AIMIM', spoiler_votes: 900, winner_margin: 500, hurts_alliance: 'MGB', label: 'AIMIM split' },
    });
    expect(legacyIncumbency(null)).toEqual({});
  });
});
