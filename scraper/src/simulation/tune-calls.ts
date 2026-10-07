/**
 * Tune CALL_THRESHOLDS on a simulation run (provisional: synthetic rounds). Usage, after sim:replay finished:
 *   npx ts-node src/simulation/tune-calls.ts [--election <id>]   (default: the election named "… (Simulation)")
 * Prints per label: points, flip rate (leader at that point ≠ final winner). Target: safe flip rate ≤ 1%.
 */
import { Client } from 'pg';
import { CALL_THRESHOLDS } from '../../../backend/src/common/seat-analysis/live';

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  const arg = process.argv.indexOf('--election');
  const id = arg > 0 ? process.argv[arg + 1] : (await db.query(`SELECT id FROM elections WHERE name LIKE '%(Simulation)%' ORDER BY year DESC LIMIT 1`)).rows[0]?.id;
  if (!id) throw new Error('no simulation election; run sim:setup + sim:replay first');
  const { rows } = await db.query(`
    SELECT s.const_id, s.round_no, s.round_total, s.leader_candidate_id AS leader, s.margin, s.votes_counted AS v, s.declared,
           (SELECT r.candidate_id FROM results r WHERE r.election_id = s.election_id AND r.const_id = s.const_id AND r.status = 'WON' LIMIT 1) AS winner
    FROM seat_rounds s WHERE s.election_id = $1 AND NOT s.declared`, [id]);
  const tally: Record<string, { n: number; flips: number }> = {};
  for (const r of rows) {
    if (!r.round_no || !r.round_total || !r.winner) continue;
    const remaining = Math.round((r.v / r.round_no) * (r.round_total - r.round_no));
    const f = remaining > 0 ? (r.margin ?? 0) / remaining : Infinity;
    const label = f < CALL_THRESHOLDS.tooClose ? 'too_close' : f < CALL_THRESHOLDS.likely ? 'likely' : 'safe';
    const t = (tally[label] ??= { n: 0, flips: 0 }); t.n++; if (r.leader !== r.winner) t.flips++;
  }
  for (const [k, t] of Object.entries(tally)) console.log(`${k.padEnd(10)} ${String(t.n).padStart(6)} points, flip rate ${(100 * t.flips / Math.max(t.n, 1)).toFixed(2)}%`);
  await db.end();
})();
