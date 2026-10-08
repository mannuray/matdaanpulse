import type { PrismaService } from '../prisma/prisma.service';
import { appendSeatRounds } from './seat-rounds';

export interface SeatRowWrite { candidate_id: string; votes: number; status: string; margin: number }
export interface SeatRound { current: number; total: number }
export interface AppliedSeat { const_id: string; state: string | null; round: SeatRound | null; rows: SeatRowWrite[] }
export interface ObservedSeat { const_id: string; state: string | null; round: SeatRound | null }

type Tx = Pick<PrismaService, '$executeRaw'>;

/**
 * The one results write (ingest batches and the admin seat correction; call it inside the transaction, under the seat
 * lock): applied seats get their result rows, rounds and seat state, and a seat-timeline row; unchanged seats only
 * advance their observation. A seat written here clears its last rejection.
 */
export async function writeSeats(tx: Tx, electionId: string, seats: { applied: AppliedSeat[]; unchanged: ObservedSeat[] },
  source: string, observedAt: Date, now: Date, timelineSource: 'ingest' | 'correction'): Promise<void> {
  const { applied, unchanged } = seats;
  const flat = applied.flatMap(a => a.rows.map(r => ({ ...r, round: a.round?.current ?? null })));
  if (flat.length) {
    await tx.$executeRaw`
      UPDATE results AS r SET votes = u.votes, status = u.status::result_status, margin = u.margin,
             round_no = COALESCE(u.round_no, r.round_no), last_updated = ${now}
      FROM UNNEST(${flat.map(r => r.candidate_id)}::uuid[], ${flat.map(r => r.votes)}::int[], ${flat.map(r => r.status)}::text[],
                  ${flat.map(r => r.margin)}::int[], ${flat.map(r => r.round)}::int[]) AS u(cid, votes, status, margin, round_no)
      WHERE r.candidate_id = u.cid AND r.election_id = ${electionId}::uuid`;
  }
  const withRound = applied.filter(a => a.round);
  if (withRound.length) {
    await tx.$executeRaw`
      UPDATE constituencies AS c SET current_round = u.cr, total_rounds = u.tr
      FROM UNNEST(${withRound.map(a => a.const_id)}::varchar[], ${withRound.map(a => a.round!.current)}::int[], ${withRound.map(a => a.round!.total)}::int[]) AS u(id, cr, tr)
      WHERE c.id = u.id AND c.election_id = ${electionId}::uuid`;
  }
  const touched = [...applied.map(a => ({ ...a, applied: true })), ...unchanged.map(u => ({ ...u, applied: false }))];
  if (touched.length) {
    await tx.$executeRaw`
      INSERT INTO seat_ingest_state (election_id, const_id, state, round_current, round_total, last_source, last_observed_at, last_applied_at)
      SELECT ${electionId}::uuid, u.id, u.state, u.rc, u.rt, ${source}, ${observedAt}, CASE WHEN u.applied THEN ${now}::timestamptz END
      FROM UNNEST(${touched.map(t => t.const_id)}::varchar[], ${touched.map(t => t.state)}::text[],
                  ${touched.map(t => t.round?.current ?? null)}::int[], ${touched.map(t => t.round?.total ?? null)}::int[],
                  ${touched.map(t => t.applied)}::bool[]) AS u(id, state, rc, rt, applied)
      ON CONFLICT (election_id, const_id) DO UPDATE SET
        state = EXCLUDED.state,
        round_current = COALESCE(EXCLUDED.round_current, seat_ingest_state.round_current),
        round_total = COALESCE(EXCLUDED.round_total, seat_ingest_state.round_total),
        last_source = EXCLUDED.last_source, last_observed_at = EXCLUDED.last_observed_at,
        last_applied_at = COALESCE(EXCLUDED.last_applied_at, seat_ingest_state.last_applied_at),
        last_rejected_reason = NULL, last_rejected_at = NULL`;
  }
  // Seat timeline (migration 025): same transaction and seat lock as the results write.
  if (applied.length) await appendSeatRounds(tx, electionId, applied.map(a => a.const_id), timelineSource, observedAt);
}

/** The seat's Live Console row: its LEADING / WON row, else the top non-NOTA row by votes; null with none. */
export function leaderRow<R extends { candidate_id: string; votes: number; status: string }>(rows: R[], partyOf: Map<string, string | null>): R | null {
  const ranked = rows.filter(r => partyOf.get(r.candidate_id) !== 'NOTA');
  return ranked.find(r => r.status === 'LEADING' || r.status === 'WON') ?? [...ranked].sort((a, b) => b.votes - a.votes)[0] ?? null;
}
