/**
 * Fake ECI HTTP server that serves HTML the real eci-vs-adapter can parse.
 * Pre-computes per-seat round snapshots (16-24 rounds per seat, staggered start in global
 * rounds 1-4) from Bihar 2025 final results. Every seat reaches "Result Declared" by global
 * round TOTAL_ROUNDS (24).
 *
 * Usage: npx ts-node src/simulation/mock-eci-server.ts
 */
import * as http from 'http';
import { Pool } from 'pg';
import {
  SOURCE_ELECTION_ID,
  MOCK_ECI_PORT,
  TOTAL_ROUNDS,
  DB_CONFIG,
  PARTY_ID_TO_NAME,
} from './config';

// --- Types ---

interface CandidateData {
  name: string;
  partyId: string;
  partyName: string;
  finalVotes: number;
}

interface ConstituencyData {
  name: string;
  constNo: number;
  candidates: CandidateData[];
}

interface RoundSnapshot {
  candidates: {
    name: string;
    partyName: string;
    votes: number;
    margin: number; // +/- relative to winner
    status: 'won' | 'lost' | '';
  }[];
  winnerName: string;
  winnerParty: string;
  runnerUpName: string;
  runnerUpParty: string;
  margin: number;
  status: string; // 'Result Declared' or 'Round N'
}

// --- Vote Progression ---

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Seeded simple random for reproducibility per constituency */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function computeRoundSnapshots(
  constituency: ConstituencyData,
  totalRounds: number
): RoundSnapshot[] {
  const snapshots: RoundSnapshot[] = [];
  const rng = seededRandom(constituency.constNo * 31337);
  const totalFinalVotes = constituency.candidates.reduce((s, c) => s + c.finalVotes, 0);

  // Check if this is a close race (final margin < 5% of total votes)
  const sortedFinal = [...constituency.candidates].sort((a, b) => b.finalVotes - a.finalVotes);
  const finalMargin = sortedFinal.length >= 2
    ? sortedFinal[0].finalVotes - sortedFinal[1].finalVotes
    : 0;
  const isCloseRace = sortedFinal.length >= 2 && finalMargin < totalFinalVotes * 0.05;

  // Pick lead-flip rounds for close races (1-3 rounds in middle third)
  const flipRounds = new Set<number>();
  if (isCloseRace) {
    const numFlips = 1 + Math.floor(rng() * 3); // 1-3
    for (let i = 0; i < numFlips; i++) {
      const flipRound = 6 + Math.floor(rng() * 7); // rounds 6-12
      flipRounds.add(flipRound);
    }
  }

  // Previous round votes for monotonicity enforcement
  const prevVotes = constituency.candidates.map(() => 0);

  for (let round = 1; round <= totalRounds; round++) {
    const isFinal = round === totalRounds;
    const progress = easeInOutCubic((round - 1) / (totalRounds - 1));
    const noiseDecay = 1 - progress; // more noise early, less late

    const votes = constituency.candidates.map((cand, idx) => {
      if (isFinal) return cand.finalVotes;

      let v = Math.floor(cand.finalVotes * progress);
      // Add noise: ±5% of current votes, decaying
      const noise = Math.floor(v * 0.05 * (2 * rng() - 1) * noiseDecay);
      v = Math.max(0, v + noise);
      // Enforce monotonic increase
      v = Math.max(v, prevVotes[idx]);
      // Don't exceed final
      v = Math.min(v, cand.finalVotes);
      return v;
    });

    // Apply lead flips for close races
    if (flipRounds.has(round) && votes.length >= 2) {
      // Find current top 2
      const indexed = votes.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
      const top = indexed[0];
      const second = indexed[1];
      // Swap by giving second slightly more votes
      const swapAmount = Math.floor((top.v - second.v) * (0.5 + rng() * 0.5)) + 1;
      votes[second.i] = Math.min(
        constituency.candidates[second.i].finalVotes,
        votes[second.i] + swapAmount
      );
    }

    // Update prevVotes for next round
    votes.forEach((v, idx) => { prevVotes[idx] = v; });

    // Compute ranking
    const ranked = votes
      .map((v, i) => ({ votes: v, idx: i }))
      .sort((a, b) => b.votes - a.votes);

    const winnerIdx = ranked[0].idx;
    const runnerUpIdx = ranked.length > 1 ? ranked[1].idx : -1;
    const margin = runnerUpIdx >= 0 ? ranked[0].votes - ranked[1].votes : ranked[0].votes;

    const candidateSnapshots = constituency.candidates.map((cand, idx) => {
      const isWinner = idx === winnerIdx;
      const candMargin = isWinner ? margin : -(votes[winnerIdx] - votes[idx]);
      return {
        name: cand.name,
        partyName: cand.partyName,
        votes: votes[idx],
        margin: candMargin,
        status: isFinal ? (isWinner ? 'won' as const : 'lost' as const) : '' as const,
      };
    });

    snapshots.push({
      candidates: candidateSnapshots,
      winnerName: constituency.candidates[winnerIdx].name,
      winnerParty: constituency.candidates[winnerIdx].partyName,
      runnerUpName: runnerUpIdx >= 0 ? constituency.candidates[runnerUpIdx].name : '',
      runnerUpParty: runnerUpIdx >= 0 ? constituency.candidates[runnerUpIdx].partyName : '',
      margin,
      status: isFinal ? 'Result Declared' : `Round ${round}`,
    });
  }

  return snapshots;
}

// --- HTML Generation ---

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatVotes(n: number): string {
  return n.toLocaleString('en-IN');
}

function generateConstituencyListPage(
  constituencies: ConstituencyData[],
  snapshots: Map<number, RoundSnapshot[]>,
  currentRound: number,
  pageNum: number,
  pageSize: number,
  startRounds: Map<number, number>
): string {
  const start = (pageNum - 1) * pageSize;
  const pageConstituencies = constituencies.slice(start, start + pageSize);

  let rows = '';
  for (const c of pageConstituencies) {
    const snap = snapshots.get(c.constNo);
    if (!snap || currentRound < 1) continue;
    // Skip constituencies that haven't started reporting yet
    const startRound = startRounds.get(c.constNo) || 1;
    if (currentRound < startRound) continue;
    const seatCurrent = Math.min(currentRound - startRound + 1, snap.length);
    const roundIdx = seatCurrent - 1;
    const s = snap[roundIdx];

    rows += `<tr>
  <td>${escHtml(c.name)}</td>
  <td>${c.constNo}</td>
  <td>${escHtml(s.winnerName)}</td>
  <td><table><tr><td>${escHtml(s.winnerParty)}</td></tr></table></td>
  <td>${escHtml(s.runnerUpName)}</td>
  <td><table><tr><td>${escHtml(s.runnerUpParty)}</td></tr></table></td>
  <td>${s.margin}</td>
  <td>${seatCurrent}/${snap.length}</td>
  <td>${seatCurrent >= snap.length ? 'Result Declared' : 'Counting In Progress'}</td>
</tr>\n`;
  }

  return `<html><body>
<table class="table-striped"><tbody>
${rows}
</tbody></table>
</body></html>`;
}

function generateCandidateDetailPage(
  constituency: ConstituencyData,
  snapshots: RoundSnapshot[],
  currentRound: number,
  startRound: number
): string {
  if (currentRound < 1 || currentRound < startRound) {
    return '<html><body><p>Counting not started</p></body></html>';
  }

  // The seat's own round, exactly as the list page computes it, so both pages agree
  const seatCurrent = Math.min(currentRound - startRound + 1, snapshots.length);
  const snap = snapshots[seatCurrent - 1];

  let boxes = '';
  for (const cand of snap.candidates) {
    const marginStr = cand.margin >= 0
      ? `+ ${formatVotes(Math.abs(cand.margin))}`
      : `- ${formatVotes(Math.abs(cand.margin))}`;
    // Only the unique leader gets 'leading'; ties and everyone else = 'trailing'
    const sortedByVotes = [...snap.candidates].sort((a, b) => b.votes - a.votes);
    const isUniqueLeader = cand.votes > 0 && cand.votes === sortedByVotes[0].votes
      && snap.candidates.filter(c => c.votes === sortedByVotes[0].votes).length === 1;
    const statusText = cand.status || (isUniqueLeader ? 'leading' : (cand.margin > 0 ? 'leading' : 'trailing'));

    boxes += `<div class="cand-box">
  <div class="nme-prty">
    <h5>${escHtml(cand.name)}</h5>
    <h6>${escHtml(cand.partyName)}</h6>
  </div>
  <div class="status">
    <div>${statusText}</div>
    <div>${formatVotes(cand.votes)} (${marginStr})</div>
  </div>
</div>\n`;
  }

  return `<html><body>
${boxes}
</body></html>`;
}

// --- Server ---

async function main() {
  const pool = new Pool(DB_CONFIG);

  console.log('Loading Bihar 2025 final results...');
  const rows = await pool.query(`
    SELECT c.name as const_name, c.const_no,
           cand.name as cand_name, cand.party_id,
           r.votes as final_votes
    FROM results r
    JOIN candidates cand ON r.candidate_id = cand.id
    JOIN constituencies c ON r.const_id = c.id
    WHERE cand.election_id = $1
    ORDER BY c.const_no, r.votes DESC
  `, [SOURCE_ELECTION_ID]);

  await pool.end();

  // Group by constituency
  const constMap = new Map<number, ConstituencyData>();
  for (const row of rows.rows) {
    if (!constMap.has(row.const_no)) {
      constMap.set(row.const_no, {
        name: row.const_name,
        constNo: row.const_no,
        candidates: [],
      });
    }
    constMap.get(row.const_no)!.candidates.push({
      name: row.cand_name,
      partyId: row.party_id,
      partyName: PARTY_ID_TO_NAME[row.party_id] || row.party_id,
      finalVotes: row.final_votes,
    });
  }

  const constituencies = [...constMap.values()].sort((a, b) => a.constNo - b.constNo);
  console.log(`Loaded ${constituencies.length} constituencies`);

  // Gradual trickle-in: assign each constituency a start round (1-4)
  // ~30% start round 1, ~30% round 2, ~25% round 3, ~15% round 4
  const constStartRound = new Map<number, number>();
  const rng = seededRandom(42);
  for (const c of constituencies) {
    const r = rng();
    const start = r < 0.30 ? 1 : r < 0.60 ? 2 : r < 0.85 ? 3 : 4;
    constStartRound.set(c.constNo, start);
  }
  const startCounts = [0, 0, 0, 0, 0];
  constStartRound.forEach(v => startCounts[v]++);
  console.log(`Trickle-in: R1=${startCounts[1]}, R2=${startCounts[2]}, R3=${startCounts[3]}, R4=${startCounts[4]}`);

  // Assign per-constituency total rounds (16-24), clamped so that a seat starting at global
  // round `start` finishes (is declared) no later than global round TOTAL_ROUNDS.
  const constTotalRounds = new Map<number, number>();
  const roundRng = seededRandom(12345);
  for (const c of constituencies) {
    const start = constStartRound.get(c.constNo) || 1;
    const tr = 16 + Math.floor(roundRng() * 9); // 16-24
    constTotalRounds.set(c.constNo, Math.min(tr, TOTAL_ROUNDS - start + 1));
  }

  // Pre-compute all round snapshots (using per-seat total rounds)
  console.log('Computing round snapshots...');
  const allSnapshots = new Map<number, RoundSnapshot[]>();
  for (const c of constituencies) {
    const seatRounds = constTotalRounds.get(c.constNo) || TOTAL_ROUNDS;
    allSnapshots.set(c.constNo, computeRoundSnapshots(c, seatRounds));
  }

  let currentRound = 0;
  const PAGE_SIZE = 19; // ~19 per page matching real ECI

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${MOCK_ECI_PORT}`);

    // API: advance round
    if (req.method === 'POST' && url.pathname === '/advance-round') {
      if (currentRound < TOTAL_ROUNDS) {
        currentRound++;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ round: currentRound, total: TOTAL_ROUNDS }));
      return;
    }

    // API: status (global)
    if (req.method === 'GET' && url.pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ currentRound, totalRounds: TOTAL_ROUNDS }));
      return;
    }

    // API: per-constituency round status
    if (req.method === 'GET' && url.pathname === '/status/constituencies') {
      const perConst: Record<number, { currentRound: number; totalRounds: number }> = {};
      for (const c of constituencies) {
        const startRound = constStartRound.get(c.constNo) || 1;
        if (currentRound < startRound) continue;
        const seatTotal = constTotalRounds.get(c.constNo) || TOTAL_ROUNDS;
        const seatCurrent = Math.min(currentRound - startRound + 1, seatTotal);
        perConst[c.constNo] = { currentRound: seatCurrent, totalRounds: seatTotal };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(perConst));
      return;
    }

    // API: reset
    if (req.method === 'POST' && url.pathname === '/reset') {
      currentRound = 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ round: 0, total: TOTAL_ROUNDS }));
      return;
    }

    // Constituency list pages: /statewiseS04{page}.htm
    const listMatch = url.pathname.match(/^\/statewiseS04(\d+)\.htm$/);
    if (listMatch) {
      const page = parseInt(listMatch[1], 10);
      const html = generateConstituencyListPage(
        constituencies, allSnapshots, currentRound, page, PAGE_SIZE, constStartRound
      );
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    // Candidate detail: /candidateswise-S04{constNo}.htm
    const detailMatch = url.pathname.match(/^\/candidateswise-S04(\d+)\.htm$/);
    if (detailMatch) {
      const constNo = parseInt(detailMatch[1], 10);
      const constituency = constMap.get(constNo);
      const snaps = allSnapshots.get(constNo);
      if (!constituency || !snaps) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const startR = constStartRound.get(constNo) || 1;
      const html = generateCandidateDetailPage(constituency, snaps, currentRound, startR);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(MOCK_ECI_PORT, () => {
    console.log(`\nMock ECI server running on http://localhost:${MOCK_ECI_PORT}`);
    console.log(`Status: curl http://localhost:${MOCK_ECI_PORT}/status`);
    console.log(`Advance: curl -X POST http://localhost:${MOCK_ECI_PORT}/advance-round`);
    console.log(`Reset:   curl -X POST http://localhost:${MOCK_ECI_PORT}/reset`);
    console.log(`\nServing ${constituencies.length} constituencies across ${Math.ceil(constituencies.length / PAGE_SIZE)} pages`);
    const roundValues = [...constTotalRounds.values()];
    const minR = Math.min(...roundValues), maxR = Math.max(...roundValues);
    console.log(`Per-seat rounds: ${minR}-${maxR} (global max ${TOTAL_ROUNDS}). Waiting for advance-round calls...`);
  });
}

main().catch((err) => {
  console.error('Mock server failed:', err);
  process.exit(1);
});
