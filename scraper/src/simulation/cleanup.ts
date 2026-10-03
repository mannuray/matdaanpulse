/**
 * Tear down simulation election (delete all related data).
 *
 * Usage: npx ts-node src/simulation/cleanup.ts [--force]
 */
import { Pool } from 'pg';
import * as readline from 'readline';
import { SIM_ELECTION_ID, DB_CONFIG } from './config';

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  const force = process.argv.includes('--force');
  const pool = new Pool(DB_CONFIG);

  try {
    // Check if election exists
    const election = await pool.query('SELECT name FROM elections WHERE id = $1', [SIM_ELECTION_ID]);
    if (election.rows.length === 0) {
      console.log('No simulation election found. Nothing to clean up.');
      return;
    }

    // Count rows
    const counts = {
      analysis: (await pool.query(
        `SELECT COUNT(*) as n FROM constituency_analysis WHERE election_id = $1`, [SIM_ELECTION_ID]
      )).rows[0].n,
      results: (await pool.query(
        `SELECT COUNT(*) as n FROM results WHERE election_id = $1`, [SIM_ELECTION_ID]
      )).rows[0].n,
      candidates: (await pool.query(
        `SELECT COUNT(*) as n FROM candidates WHERE election_id = $1`, [SIM_ELECTION_ID]
      )).rows[0].n,
      constituencies: (await pool.query(
        `SELECT COUNT(*) as n FROM constituencies WHERE election_id = $1`, [SIM_ELECTION_ID]
      )).rows[0].n,
    };

    console.log(`\nSimulation election: ${election.rows[0].name}`);
    console.log(`ID: ${SIM_ELECTION_ID}`);
    console.log(`\nRows to delete:`);
    console.log(`  constituency_analysis: ${counts.analysis}`);
    console.log(`  results:              ${counts.results}`);
    console.log(`  candidates:           ${counts.candidates}`);
    console.log(`  constituencies:       ${counts.constituencies}`);
    console.log(`  elections:            1`);

    if (!force) {
      const ok = await confirm('\nProceed with deletion?');
      if (!ok) {
        console.log('Aborted.');
        return;
      }
    }

    // Delete in FK order within transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const t of ['seat_holds', 'seat_ingest_state', 'ingest_log', 'ingest_shards', 'election_ingest']) {
        await client.query(`DELETE FROM ${t} WHERE election_id = $1`, [SIM_ELECTION_ID]);
      }
      await client.query("DELETE FROM ingest_keys WHERE name = 'simulation'");
      await client.query('DELETE FROM constituency_analysis WHERE election_id = $1', [SIM_ELECTION_ID]);
      await client.query('DELETE FROM results WHERE election_id = $1', [SIM_ELECTION_ID]);
      await client.query('DELETE FROM candidates WHERE election_id = $1', [SIM_ELECTION_ID]);
      await client.query('DELETE FROM constituencies WHERE election_id = $1', [SIM_ELECTION_ID]);
      await client.query('DELETE FROM elections WHERE id = $1', [SIM_ELECTION_ID]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    console.log('\nCleanup complete.');

  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
