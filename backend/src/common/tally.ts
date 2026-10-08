/** Seats won and leading for one party. */
export interface SeatCount {
  won: number;
  leading: number;
}

/**
 * Seats won and leading per party from result rows (one row per candidate). Only WON and LEADING rows count;
 * rows without a party are left out. Parties appear in first-seen order. The SQL aggregates
 * (getElectionSummary) count the same way.
 */
export function seatTally(rows: Iterable<{ party_id: string | null; status: string }>): Map<string, SeatCount> {
  const out = new Map<string, SeatCount>();
  for (const r of rows) {
    if (!r.party_id || (r.status !== 'WON' && r.status !== 'LEADING')) continue;
    const e = out.get(r.party_id) ?? out.set(r.party_id, { won: 0, leading: 0 }).get(r.party_id)!;
    if (r.status === 'WON') e.won++;
    else e.leading++;
  }
  return out;
}
