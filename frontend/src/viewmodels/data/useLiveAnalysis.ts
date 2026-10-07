import { useMemo } from 'react';
import { analyseLive, type Baseline, type SeatLive, type LiveTally, type SeatTrail } from '../../model/derive/seatAnalysis';
import type { ResultRow, SeatLiveState } from '../../model/types';

/** analyseLive on the current snapshot: one entry per seat with result rows. Null without a baseline. */
export function useLiveAnalysis(baseline: Baseline | null, results: ResultRow[] | null, seats: Record<string, SeatLiveState>, trails: Record<string, SeatTrail>): { seats: Map<string, SeatLive>; tally: LiveTally } | null {
  return useMemo(() => {
    if (!baseline || !results) return null;
    const byConst = new Map<string, ResultRow[]>();
    for (const r of results) (byConst.get(r.const_id) ?? byConst.set(r.const_id, []).get(r.const_id)!).push(r);
    const input = [...byConst].map(([const_id, rows]) => {
      const st = seats[const_id];
      return { const_id, candidates: rows.map(r => ({ person_id: null, name: r.candidate_name, party_id: r.party_id || null, votes: Number(r.votes) || 0, status: r.status })),
        round: st?.cr && st.tr ? { current: st.cr, total: st.tr } : null, trail: trails[const_id] ?? null };
    });
    const out = analyseLive(baseline, input);
    return { seats: new Map(out.seats.map(s => [s.const_id, s])), tally: out.tally };
  }, [baseline, results, seats, trails]);
}
