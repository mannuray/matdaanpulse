/**
 * Orchestrator: advance mock ECI rounds and push result overrides to the backend.
 *
 * Usage:
 *   SIM_ADMIN_EMAIL=... SIM_ADMIN_PASSWORD=... npx ts-node src/simulation/replay.ts [--delay-ms 5000] [--rounds 24]
 *
 * Credentials: SIM_ADMIN_EMAIL / SIM_ADMIN_PASSWORD (falls back to ADMIN_EMAIL / ADMIN_PASSWORD,
 * the account created by `cd backend && npm run create-admin`). --email / --password override.
 */
import { Pool } from 'pg';
import { EciVsAdapter, CandidateDetail } from '../adapters/eci-vs-adapter';
import {
  SIM_ELECTION_ID,
  MOCK_ECI_PORT,
  TOTAL_ROUNDS,
  DEFAULT_ROUND_DELAY_MS,
  BACKEND_BASE,
  DB_CONFIG,
  PARTY_NAME_TO_ID,
  ALLIANCES,
} from './config';

// --- CLI args ---

function parseArgs(): { email: string; password: string; delayMs: number; rounds: number } {
  const args = process.argv.slice(2);
  let email = process.env.SIM_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
  let password = process.env.SIM_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  let delayMs = DEFAULT_ROUND_DELAY_MS, rounds = TOTAL_ROUNDS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) email = args[++i];
    else if (args[i] === '--password' && args[i + 1]) password = args[++i];
    else if (args[i] === '--delay-ms' && args[i + 1]) delayMs = parseInt(args[++i], 10);
    else if (args[i] === '--rounds' && args[i + 1]) rounds = parseInt(args[++i], 10);
  }

  if (!email || !password) {
    console.error('Missing admin credentials. Set SIM_ADMIN_EMAIL and SIM_ADMIN_PASSWORD (or ADMIN_EMAIL / ADMIN_PASSWORD).');
    console.error(`Usage: npx ts-node src/simulation/replay.ts [--delay-ms ${DEFAULT_ROUND_DELAY_MS}] [--rounds ${TOTAL_ROUNDS}]`);
    process.exit(1);
  }
  return { email, password, delayMs, rounds };
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Render a backend error body ({ success:false, error:{ message, fields? } }) as one readable string. */
function describeApiError(raw: string): string {
  try {
    const e = JSON.parse(raw)?.error;
    if (typeof e?.message !== 'string') return raw;
    const fields = Array.isArray(e.fields) ? e.fields.map((f: { field: string; message: string }) => `${f.field}: ${f.message}`) : [];
    return `${e.code ? `[${e.code}] ` : ''}${e.message}${fields.length ? ` (${fields.join('; ')})` : ''}`;
  } catch {
    return raw;
  }
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BACKEND_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${describeApiError(await res.text())}`);
  const body = await res.json() as any;
  // Backend wraps JSON responses as { success, data: {...} }; accept the unwrapped shape too.
  const payload = body?.data ?? body;
  const token = payload?.access_token || payload?.token;
  if (!token) throw new Error('Login response missing token field');
  return token;
}

interface BulkOverrideItem {
  result_id: string;
  const_id: string;
  party_id: string;
  votes: number;
  status: string;
  margin: number;
  round_no?: number;
}

interface ConstituencyRoundDto {
  current_round?: number;
  total_rounds?: number;
}

async function bulkOverride(
  token: string,
  electionId: string,
  overrides: BulkOverrideItem[],
  rounds: Record<string, ConstituencyRoundDto>,
): Promise<void> {
  const res = await fetch(`${BACKEND_BASE}/admin/results/override-bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ election_id: electionId, overrides, rounds }),
  });
  if (!res.ok) {
    const body = describeApiError(await res.text());
    throw new Error(`Bulk override failed: ${res.status} ${body}`);
  }
}

async function fetchConstituencyRounds(): Promise<Record<string, { currentRound: number; totalRounds: number }>> {
  const res = await fetch(`http://localhost:${MOCK_ECI_PORT}/status/constituencies`);
  if (!res.ok) throw new Error(`Failed to fetch constituency rounds: ${res.status}`);
  return res.json() as any;
}

async function advanceRound(): Promise<{ round: number; total: number }> {
  const res = await fetch(`http://localhost:${MOCK_ECI_PORT}/advance-round`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to advance round: ${res.status}`);
  return res.json() as any;
}

// --- Adapter interaction (real ECI adapter pointed at the mock server) ---

const mockAdapter = new EciVsAdapter({
  baseUrl: `http://localhost:${MOCK_ECI_PORT}`,
  pageDelayMs: 0,
  verbose: false,
});

function fetchMockConstituencyList() {
  return mockAdapter.fetchConstituencyList();
}

function fetchMockCandidateDetail(constNo: number): Promise<CandidateDetail[]> {
  return mockAdapter.fetchConstituencyDetail(constNo);
}

/**
 * Key identifying one candidate within a constituency. Party alone is not unique:
 * several Independents (IND) can contest the same seat, so include the name.
 */
function candidateKey(name: string, partyId: string): string {
  return `${name.trim().replace(/\s+/g, ' ').toUpperCase()}|${partyId}`;
}

function resolvePartyId(partyName: string): string | null {
  return PARTY_NAME_TO_ID[partyName] || null;
}

function getAlliance(partyId: string): string {
  for (const [alliance, parties] of Object.entries(ALLIANCES)) {
    if (parties.includes(partyId)) return alliance;
  }
  return 'Others';
}

// --- Main ---

async function main() {
  const { email, password, delayMs, rounds } = parseArgs();

  // 1. Login
  console.log('Logging in...');
  const token = await login(email, password);
  console.log('Authenticated.');

  // 2. Load result-to-candidate mapping from DB
  console.log('Loading result mappings...');
  const pool = new Pool(DB_CONFIG);
  let mappingRows;
  try {
    mappingRows = await pool.query(`
      SELECT r.id as result_id, c.const_no, c.id as const_id, cand.party_id, cand.name as cand_name
      FROM results r
      JOIN candidates cand ON r.candidate_id = cand.id
      JOIN constituencies c ON r.const_id = c.id
      WHERE r.election_id = $1
    `, [SIM_ELECTION_ID]);
  } catch (err) {
    console.error(`Failed to load result mappings for election ${SIM_ELECTION_ID}:`, err);
    throw err;
  } finally {
    await pool.end();
  }

  // Map<constNo, { constId, results: Map<candidateKey(name, partyId), resultId> }>
  const resultMap = new Map<number, { constId: string; results: Map<string, string> }>();
  for (const row of mappingRows.rows) {
    if (!resultMap.has(row.const_no)) resultMap.set(row.const_no, { constId: row.const_id, results: new Map() });
    resultMap.get(row.const_no)!.results.set(candidateKey(row.cand_name, row.party_id), row.result_id);
  }
  console.log(`Loaded ${mappingRows.rows.length} result mappings across ${resultMap.size} constituencies\n`);

  // 3. Round loop
  const effectiveRounds = Math.min(rounds, TOTAL_ROUNDS);
  for (let round = 1; round <= effectiveRounds; round++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ROUND ${round}/${effectiveRounds}`);
    console.log('='.repeat(60));

    // Advance mock server
    const { round: serverRound } = await advanceRound();
    console.log(`Mock server at round ${serverRound}`);

    // Fetch constituency list and per-seat round info
    const [constList, constRounds] = await Promise.all([
      fetchMockConstituencyList(),
      fetchConstituencyRounds(),
    ]);
    console.log(`Fetched ${constList.length} constituencies from mock server`);

    // Collect all overrides for this round into a single bulk request
    const tally: Record<string, number> = {};
    const bulkItems: BulkOverrideItem[] = [];
    const bulkRounds: Record<string, ConstituencyRoundDto> = {};

    let skippedSeats = 0;
    const unmatchedCandidates = new Set<string>();

    for (const c of constList) {
      let candidates;
      try {
        candidates = await fetchMockCandidateDetail(c.constNo);
      } catch (err) {
        console.warn(`  Skipping constNo ${c.constNo} (${c.name}): ${(err as Error).message}`);
        skippedSeats++;
        continue;
      }

      const mapping = resultMap.get(c.constNo);
      if (!mapping) {
        console.warn(`  No result mapping for constNo ${c.constNo} (${c.name})`);
        skippedSeats++;
        continue;
      }

      const { constId, results: constResultMap } = mapping;

      // Per-seat round info
      const seatRound = constRounds[c.constNo];
      if (seatRound) {
        bulkRounds[constId] = { current_round: seatRound.currentRound, total_rounds: seatRound.totalRounds };
      }

      // Determine who is actually leading
      const maxVotes = Math.max(...candidates.map(c => c.votes));
      const leaderCount = candidates.filter(c => c.votes === maxVotes).length;

      for (const cand of candidates) {
        const partyId = resolvePartyId(cand.party) || cand.party;

        const resolveStatus = (): string => {
          if (cand.status === 'won') return 'WON';
          if (cand.status === 'lost') return 'LOST';
          if (cand.votes > 0 && cand.votes === maxVotes && leaderCount === 1) return 'LEADING';
          return 'TRAILING';
        };

        const resultId = constResultMap.get(candidateKey(cand.name, partyId));
        if (!resultId) {
          unmatchedCandidates.add(`${cand.name} (${partyId})`);
          continue;
        }

        bulkItems.push({
          result_id: resultId,
          const_id: constId,
          party_id: partyId,
          votes: cand.votes,
          status: resolveStatus(),
          margin: Math.abs(cand.margin),
          round_no: round,
        });
      }

      // Track winner for tally
      if (c.winnerParty) {
        const winnerId = resolvePartyId(c.winnerParty);
        if (winnerId) {
          const alliance = getAlliance(winnerId);
          tally[alliance] = (tally[alliance] || 0) + 1;
        }
      }
    }

    if (skippedSeats > 0) console.warn(`  ${skippedSeats} constituencies skipped this round`);
    if (unmatchedCandidates.size > 0) console.warn(`  Unmatched candidates (no DB result): ${[...unmatchedCandidates].join(', ')}`);

    // Send single bulk request for the entire round
    if (bulkItems.length > 0) {
      await bulkOverride(token, SIM_ELECTION_ID, bulkItems, bulkRounds);
    }

    // Print round summary
    console.log(`\nRound ${round} complete: ${bulkItems.length} results pushed (1 bulk request)`);
    console.log('Tally:', Object.entries(tally).map(([a, n]) => `${a}: ${n}`).join(' | '));

    if (round < effectiveRounds) {
      console.log(`Waiting ${delayMs}ms before next round...`);
      await sleep(delayMs);
    }
  }

  console.log('\n\n=== SIMULATION COMPLETE ===');
  console.log(`All ${effectiveRounds} rounds replayed.`);
}

main().catch((err) => {
  console.error('Replay failed:', err);
  process.exit(1);
});
