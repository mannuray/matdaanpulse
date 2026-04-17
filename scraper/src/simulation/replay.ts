/**
 * Orchestrator: advance mock ECI rounds and push result overrides to the backend.
 *
 * Usage:
 *   npx ts-node src/simulation/replay.ts --email admin@tracker.local --password admin123 [--delay-ms 5000] [--rounds 18]
 */
import { Pool } from 'pg';
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
  let email = '', password = '', delayMs = DEFAULT_ROUND_DELAY_MS, rounds = TOTAL_ROUNDS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) email = args[++i];
    else if (args[i] === '--password' && args[i + 1]) password = args[++i];
    else if (args[i] === '--delay-ms' && args[i + 1]) delayMs = parseInt(args[++i], 10);
    else if (args[i] === '--rounds' && args[i + 1]) rounds = parseInt(args[++i], 10);
  }

  if (!email || !password) {
    console.error('Usage: npx ts-node src/simulation/replay.ts --email <email> --password <password> [--delay-ms 5000] [--rounds 18]');
    process.exit(1);
  }
  return { email, password, delayMs, rounds };
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BACKEND_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  const token = data.access_token || data.token;
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
    const body = await res.text();
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

// --- Adapter interaction (inline, to set custom BASE_URL) ---

async function fetchMockConstituencyList(): Promise<any[]> {
  const results: any[] = [];
  const totalPages = 13;

  for (let page = 1; page <= totalPages; page++) {
    const url = `http://localhost:${MOCK_ECI_PORT}/statewiseS04${page}.htm`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  Mock server page ${page} returned ${res.status}, skipping`);
      continue;
    }
    const html = await res.text();

    // Use dynamic import for cheerio
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    $('table.table-striped tbody tr').each((_i: number, row: any) => {
      const cells = $(row).children('td');
      if (cells.length < 7) return;

      const name = $(cells[0]).text().trim();
      const constNo = parseInt($(cells[1]).text().trim(), 10);
      if (!name || isNaN(constNo)) return;

      const winnerName = $(cells[2]).text().trim();
      const winnerParty = $(cells[3]).find('td').first().text().trim();
      const runnerUpName = $(cells[4]).text().trim();
      const runnerUpParty = $(cells[5]).find('td').first().text().trim();
      const margin = parseInt($(cells[6]).text().trim(), 10) || 0;
      const status = $(cells[8]).text().trim();

      results.push({ name, constNo, winnerName, winnerParty, runnerUpName, runnerUpParty, margin, status });
    });
  }

  return results;
}

async function fetchMockCandidateDetail(constNo: number): Promise<any[]> {
  const url = `http://localhost:${MOCK_ECI_PORT}/candidateswise-S04${constNo}.htm`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Candidate detail fetch failed for constNo ${constNo}: ${res.status}`);
  const html = await res.text();

  const cheerio = await import('cheerio');
  const $ = cheerio.load(html);

  const candidates: any[] = [];
  $('.cand-box').each((_i: number, box: any) => {
    const name = $(box).find('.nme-prty h5').text().trim();
    const party = $(box).find('.nme-prty h6').text().trim();
    const statusEl = $(box).find('.status');
    const statusText = statusEl.find('div').first().text().trim().toLowerCase();

    const voteText = statusEl.find('div').eq(1).text().trim();
    const voteMatch = voteText.match(/^([\d,]+)/);
    const votes = voteMatch ? parseInt(voteMatch[1].replace(/,/g, ''), 10) : 0;

    const marginMatch = voteText.match(/\(\s*([+-])\s*([\d,]+)\s*\)/);
    const margin = marginMatch
      ? (marginMatch[1] === '+' ? 1 : -1) * parseInt(marginMatch[2].replace(/,/g, ''), 10)
      : 0;

    candidates.push({ name, party, votes, margin, status: statusText });
  });

  return candidates;
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
      SELECT r.id as result_id, c.const_no, c.id as const_id, cand.party_id
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

  // Map<constNo, { constId, parties: Map<partyId, resultId> }>
  const resultMap = new Map<number, { constId: string; parties: Map<string, string> }>();
  for (const row of mappingRows.rows) {
    if (!resultMap.has(row.const_no)) resultMap.set(row.const_no, { constId: row.const_id, parties: new Map() });
    resultMap.get(row.const_no)!.parties.set(row.party_id, row.result_id);
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
    const unmatchedParties = new Set<string>();

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

      const { constId, parties: constResultMap } = mapping;

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

        const resultId = constResultMap.get(partyId);
        if (!resultId) {
          unmatchedParties.add(partyId);
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
    if (unmatchedParties.size > 0) console.warn(`  Unmatched parties (no DB result): ${[...unmatchedParties].join(', ')}`);

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
