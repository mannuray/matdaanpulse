/**
 * A seat won unopposed (no poll; Arunachal 2009-2024, Surat LS 2024): declared, its only candidate won, and no votes
 * were polled. Such a seat counts in tallies and is coloured for its winner, but has no margin, turnout or swing, and
 * never ranks as a close contest. A seat still counting (LEADING at 0 votes) is not unopposed.
 */
export function isUncontested(candidates: { party_id: string | null; votes: number | null; status: string | null }[]): boolean {
  const real = candidates.filter(c => c.party_id !== 'NOTA');
  return real.length === 1 && real[0].status === 'WON' && candidates.every(c => !c.votes);
}

/** A seat's headline margin (the winner's), none while pending; a seat won unopposed has none and is flagged. */
export function headlineMargin(candidates: { party_id: string | null; votes: number | null; status: string | null }[],
  winner: { margin?: number | string | null } | undefined): { margin: number | undefined; uncontested?: true } {
  if (!winner) return { margin: undefined };
  if (isUncontested(candidates)) return { margin: undefined, uncontested: true };
  return { margin: Number(winner.margin) || 0 };
}

/**
 * From a seat's winning row alone: declared, no votes polled and no margin (data with margins but no vote counts is
 * not unopposed). A live seat marked WON before its votes post would still need a 0 margin to match.
 */
export function isUnopposedWinner(w: { status: string | null; votes: number | null; margin?: number | string | null }): boolean {
  return w.status === 'WON' && !w.votes && !Number(w.margin);
}
