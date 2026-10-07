import type { SeatAnalysis } from '../../common/seat-analysis';

/**
 * The pre-024 `incumbency` JSON built from the new SeatAnalysis, so a frontend deployed before this backend keeps
 * working. Remove in the follow-up release (spec §4.5 "Compatibility").
 */
export function legacyIncumbency(d: SeatAnalysis | null): Record<string, unknown> {
  if (!d) return {};
  const inc = d.incumbent;
  const sp = d.notes.find(n => n.kind === 'spoiler' && n.hurts) as Extract<SeatAnalysis['notes'][number], { kind: 'spoiler' }> | undefined;
  return {
    ...(inc ? { incumbent_name: inc.name, incumbent_party: inc.party, re_contesting: inc.recontested, ...(inc.won != null ? { won: inc.won } : {}),
      ...(inc.switched ? { switched_to: inc.party_now } : {}), ...(inc.followed_split ? { followed_split: inc.party_now } : {}) } : {}),
    ...(d.outcome && d.outcome.kind !== 'new' && d.winner
      ? { swing: { prev_party: d.outcome.from_raw, curr_party: d.winner.party_id, flipped: d.outcome.kind === 'gained', split: d.outcome.kind === 'split', margin: d.margin ?? 0 } } : {}),
    seat_type: d.seat_type,
    dominance_wins: d.class?.wins ?? 0,
    dominance_total: d.class?.total ?? 0,
    seat_history: d.history.map(h => ({ year: h.year, party: h.party, candidate: h.candidate, margin: h.margin, vote_share: h.vote_share, runner_up: h.runner_up, runner_up_party: h.runner_up_party })),
    ...(sp ? { spoiler: { spoiler_party: sp.party, spoiler_votes: sp.votes, winner_margin: sp.margin, hurts_alliance: sp.hurts, label: sp.label } } : {}),
  };
}
