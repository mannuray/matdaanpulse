import type { Prisma } from '@prisma/client';

/**
 * Seat timeline (migration 025): for each seat in `constIds`, append a row when its leader, runner-up, margin or
 * declared state differs from its latest row. One set-based statement. Call it inside the transaction that holds the
 * seat lock (`lockSeats`) and after the results write, so `seq = latest + 1` cannot race.
 * Leader = the WON/LEADING row, else the most votes; NOTA is never leader or runner-up; votes_counted includes NOTA.
 */
export async function appendSeatRounds(tx: Pick<Prisma.TransactionClient, '$executeRaw'>, electionId: string, constIds: string[], source: string, observedAt: Date): Promise<number> {
  const ids = [...new Set(constIds)];
  if (!ids.length) return 0;
  return tx.$executeRaw`
    WITH ranked AS (
      SELECT r.const_id, r.candidate_id, r.votes, r.status,
             row_number() OVER (PARTITION BY r.const_id ORDER BY (r.status IN ('WON', 'LEADING')) DESC, r.votes DESC, r.candidate_id) AS rn
      FROM results r JOIN candidates c ON c.id = r.candidate_id
      WHERE r.election_id = ${electionId}::uuid AND r.const_id = ANY(${ids}::varchar[]) AND c.party_id IS DISTINCT FROM 'NOTA'
    ),
    cur AS (
      SELECT k.const_id,
             (array_agg(k.candidate_id ORDER BY k.rn) FILTER (WHERE k.rn = 1))[1] AS leader,
             (array_agg(k.candidate_id ORDER BY k.rn) FILTER (WHERE k.rn = 2))[1] AS runner,
             max(k.votes) FILTER (WHERE k.rn = 1) - coalesce(max(k.votes) FILTER (WHERE k.rn = 2), 0) AS margin,
             bool_or(k.status = 'WON') AS declared,
             (SELECT coalesce(sum(r2.votes), 0) FROM results r2 WHERE r2.election_id = ${electionId}::uuid AND r2.const_id = k.const_id)::int AS counted
      FROM ranked k GROUP BY k.const_id
    ),
    last AS (
      SELECT DISTINCT ON (s.const_id) s.const_id, s.seq, s.leader_candidate_id, s.runner_up_candidate_id, s.margin, s.declared
      FROM seat_rounds s WHERE s.election_id = ${electionId}::uuid AND s.const_id = ANY(${ids}::varchar[])
      ORDER BY s.const_id, s.seq DESC
    )
    INSERT INTO seat_rounds (election_id, const_id, seq, round_no, round_total, leader_candidate_id, runner_up_candidate_id, margin, votes_counted, declared, observed_at, source)
    SELECT ${electionId}::uuid, cur.const_id, coalesce(last.seq, 0) + 1, k.current_round, k.total_rounds, cur.leader, cur.runner, cur.margin, cur.counted, cur.declared, ${observedAt}, ${source}
    FROM cur
    JOIN constituencies k ON k.id = cur.const_id
    LEFT JOIN last ON last.const_id = cur.const_id
    WHERE cur.counted > 0 AND (last.const_id IS NULL
       OR last.leader_candidate_id IS DISTINCT FROM cur.leader OR last.runner_up_candidate_id IS DISTINCT FROM cur.runner
       OR last.margin IS DISTINCT FROM cur.margin OR last.declared IS DISTINCT FROM cur.declared)`;
}
