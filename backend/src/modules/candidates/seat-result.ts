/** One candidate of a seat, as the admin candidate page's result strip and "Other candidates" list show it. */
export interface SeatRow {
  candidate_id: string;
  name: string;
  party_id: string | null;
  votes: number | null;
  /** Percent of all votes in the seat (NOTA included), 1 decimal; null when the seat has no votes recorded. */
  share: number | null;
  /** Rank by votes among the non-NOTA candidates; with no votes recorded only the winner (1) has one. */
  position: number | null;
  status: string | null;
  /** The winner's `results.margin`; for others the vote gap to the winner (≤ 0), null when there are no votes. */
  margin: number | null;
}

export interface SeatResult {
  declared: boolean;
  total_votes: number;
  candidate: SeatRow | null;
  seat: SeatRow[];
}

type SeatCandidate = {
  id: string;
  name: string;
  party_id: string | null;
  results: { votes: number | null; status: string; margin: number | null }[];
};

const isNota = (c: { party_id: string | null }) => c.party_id === 'NOTA';

/**
 * Pure: derives vote share, position and margin for every candidate of one seat. The winner (the reference
 * for margins) is the WON row, else the LEADING one, else the top non-NOTA candidate by votes when any votes
 * exist. Seats with margins but no vote counts (TN 2021) get no shares and no loser margins, never NaN.
 */
export function seatResult(candidateId: string, declared: boolean, candidates: SeatCandidate[]): SeatResult {
  const rows = candidates.map((c) => {
    const r = c.results[0];
    return { c, votes: r ? r.votes : null, status: r ? r.status : null, margin: r ? r.margin : null };
  });
  const total = rows.reduce((n, r) => n + (r.votes ?? 0), 0);
  const byVotes = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    (b.votes ?? -1) - (a.votes ?? -1) || a.c.name.localeCompare(b.c.name);
  const contenders = rows.filter((r) => !isNota(r.c)).sort(byVotes);
  const winner = contenders.find((r) => r.status === 'WON')
    ?? contenders.find((r) => r.status === 'LEADING')
    ?? (total > 0 && (contenders[0]?.votes ?? 0) > 0 ? contenders[0] : undefined);

  // Winner first when votes tie or are missing, then by votes; NOTA last.
  const ordered = [
    ...(winner ? [winner] : []),
    ...contenders.filter((r) => r !== winner),
    ...rows.filter((r) => isNota(r.c)).sort(byVotes),
  ];
  if (total > 0) ordered.sort((a, b) => Number(isNota(a.c)) - Number(isNota(b.c)) || byVotes(a, b));

  const position = (r: (typeof rows)[number]): number | null => {
    if (isNota(r.c)) return null;
    if (total === 0 || r.votes === null) return r === winner ? 1 : null;
    // Competition ranking: equal votes share a position.
    return contenders.filter((o) => (o.votes ?? -1) > r.votes!).length + 1;
  };
  const margin = (r: (typeof rows)[number]): number | null => {
    if (r === winner) return r.margin;
    if (isNota(r.c) || !winner || total === 0 || r.votes === null || winner.votes === null) return null;
    return r.votes - winner.votes;
  };

  const seat: SeatRow[] = ordered.map((r) => ({
    candidate_id: r.c.id,
    name: r.c.name,
    party_id: r.c.party_id,
    votes: r.votes,
    share: total > 0 && r.votes !== null ? Math.round((r.votes / total) * 1000) / 10 : null,
    position: position(r),
    status: r.status,
    margin: margin(r),
  }));
  return { declared, total_votes: total, candidate: seat.find((s) => s.candidate_id === candidateId) ?? null, seat };
}
