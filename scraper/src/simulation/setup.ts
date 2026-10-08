/**
 * Clone Bihar 2025 → Bihar 2027 (Simulation) Live election.
 *
 * Usage: npx ts-node src/simulation/setup.ts
 */
import { Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { SIM_ELECTION_ID, SOURCE_ELECTION_ID, STATE_ID, DB_CONFIG } from './config';

async function main() {
  const pool = new Pool(DB_CONFIG);

  try {
    // 1. Idempotency check
    const existing = await pool.query('SELECT id FROM elections WHERE id = $1', [SIM_ELECTION_ID]);
    if (existing.rows.length > 0) {
      console.log('Simulation election already exists. Run cleanup.ts first to reset.');
      return;
    }

    // 2. Clone election row (with its delimitation: without it the seats compare with nothing and the baseline is empty)
    console.log('Creating simulation election...');
    await pool.query(`
      INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date, manifest_url, delimitation)
      SELECT $1, 'Bihar Vidhan Sabha 2027 (Simulation)', type, state_id, 2027, 'Live', NULL, manifest_url, delimitation
      FROM elections WHERE id = $2
    `, [SIM_ELECTION_ID, SOURCE_ELECTION_ID]);

    // Update manifest: replace source election ID references with sim ID, and seat ids (watchlists, leaders,
    // vip_seats) with the cloned seats' (BR_VS_ → BR_VS27_, as in step 3), or leader cards never match a seat.
    await pool.query(`
      UPDATE elections
      SET manifest_url = REPLACE(REPLACE(manifest_url::text, $2::text, $1::text), '"BR_VS_', '"BR_VS27_')::jsonb
      WHERE id = $1
    `, [SIM_ELECTION_ID, SOURCE_ELECTION_ID]);

    // 3. Clone constituencies
    console.log('Cloning 243 constituencies...');
    const constRows = await pool.query(
      `SELECT id, name, const_no, type, voter_turnout, phase, total_electors, district_id
       FROM constituencies WHERE election_id = $1 ORDER BY const_no`,
      [SOURCE_ELECTION_ID]
    );

    const constIdMap = new Map<string, string>(); // old → new
    const constValues: string[] = [];
    const constParams: any[] = [];
    let pi = 1;

    for (const row of constRows.rows) {
      const newId = row.id.replace('BR_VS_', 'BR_VS27_');
      constIdMap.set(row.id, newId);
      constValues.push(`($${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++})`);
      constParams.push(
        newId, SIM_ELECTION_ID, row.district_id, STATE_ID,
        row.name, row.const_no, row.type, row.voter_turnout, row.phase, row.total_electors
      );
    }

    await pool.query(
      `INSERT INTO constituencies (id, election_id, district_id, state_id, name, const_no, type, voter_turnout, phase, total_electors)
       VALUES ${constValues.join(',\n')}`,
      constParams
    );
    console.log(`  ${constIdMap.size} constituencies created`);

    // 4. Clone candidates
    console.log('Cloning candidates...');
    const candRows = await pool.query(
      `SELECT id, person_id, const_id, party_id, name, is_incumbent
       FROM candidates WHERE election_id = $1`,
      [SOURCE_ELECTION_ID]
    );

    const candIdMap = new Map<string, string>(); // old → new
    // Insert in batches of 200 to avoid parameter limit
    const BATCH_SIZE = 200;
    for (let b = 0; b < candRows.rows.length; b += BATCH_SIZE) {
      const batch = candRows.rows.slice(b, b + BATCH_SIZE);
      const vals: string[] = [];
      const params: any[] = [];
      let p = 1;

      for (const row of batch) {
        const newConstId = constIdMap.get(row.const_id);
        if (!newConstId) continue;
        // Only map candidates that are actually inserted, so counts and result rows match
        const newCandId = randomUUID();
        candIdMap.set(row.id, newCandId);

        // The clone keeps the source person (same politician); without one, the DB creates it.
        vals.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
        params.push(
          newCandId, row.person_id, SIM_ELECTION_ID, newConstId,
          row.party_id, row.name, row.is_incumbent
        );
      }

      if (vals.length > 0) {
        await pool.query(
          `INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent)
           VALUES ${vals.join(',\n')}`,
          params
        );
      }
    }
    console.log(`  ${candIdMap.size} candidates created`);

    // 5. Create zeroed result rows
    console.log('Creating zeroed result rows...');
    for (let b = 0; b < candRows.rows.length; b += BATCH_SIZE) {
      const batch = candRows.rows.slice(b, b + BATCH_SIZE);
      const vals: string[] = [];
      const params: any[] = [];
      let p = 1;

      for (const row of batch) {
        const newCandId = candIdMap.get(row.id);
        const newConstId = constIdMap.get(row.const_id);
        if (!newCandId || !newConstId) continue;

        vals.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
        params.push(randomUUID(), newCandId, newConstId, SIM_ELECTION_ID, 0, 'TRAILING', 0);
      }

      if (vals.length > 0) {
        await pool.query(
          `INSERT INTO results (id, candidate_id, const_id, election_id, votes, status, margin)
           VALUES ${vals.join(',\n')}`,
          params
        );
      }
    }
    console.log(`  ${candIdMap.size} result rows created`);

    // 6. Ingest feed + key (the sim is a dev tool that writes SQL directly; production keys come from the admin)
    const simKey = `mpk_${randomBytes(32).toString('base64url')}`;
    await pool.query(`DELETE FROM ingest_keys WHERE name = 'simulation'`);
    await pool.query(`INSERT INTO ingest_keys (name, key_hash) VALUES ('simulation', $1)`, [createHash('sha256').update(simKey).digest('hex')]);
    await pool.query(`INSERT INTO election_ingest (election_id, active_source) VALUES ($1, 'mock-eci')
                      ON CONFLICT (election_id) DO UPDATE SET active_source = 'mock-eci'`, [SIM_ELECTION_ID]);
    writeFileSync(join(__dirname, '../../.sim-ingest-key'), simKey);
    console.log(`SIM_INGEST_KEY=${simKey}  (also in scraper/.sim-ingest-key)`);

    // Summary
    console.log('\n=== Setup Complete ===');
    console.log(`Election ID: ${SIM_ELECTION_ID}`);
    console.log(`Name: Bihar Vidhan Sabha 2027 (Simulation)`);
    console.log(`Status: Live`);
    console.log(`Constituencies: ${constIdMap.size}`);
    console.log(`Candidates: ${candIdMap.size}`);
    console.log('\nNext: start the mock ECI server, then `npm run sim:live` (worker) and `npm run sim:replay`');

  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
