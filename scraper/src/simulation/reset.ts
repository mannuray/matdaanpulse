/**
 * Reset simulation: zero out all results without deleting the election.
 * Much faster than cleanup + setup for restarting the simulation.
 *
 * Usage: npx ts-node src/simulation/reset.ts
 */
import { Pool } from 'pg';
import { SIM_ELECTION_ID, DB_CONFIG } from './config';

async function main() {
  const pool = new Pool(DB_CONFIG);

  try {
    const election = await pool.query('SELECT name FROM elections WHERE id = $1', [SIM_ELECTION_ID]);
    if (election.rows.length === 0) {
      console.log('No simulation election found. Run setup.ts first.');
      return;
    }

    const { rowCount } = await pool.query(`
      UPDATE results
      SET votes = 0, status = 'TRAILING', margin = 0, last_updated = NOW()
      WHERE election_id = $1
    `, [SIM_ELECTION_ID]);

    console.log(`Reset ${rowCount} results to zero. Ready for replay.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
