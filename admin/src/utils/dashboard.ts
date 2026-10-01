import type { Election, LiveConstituency, SeatLock } from '../types';
import type { SystemStatus } from '../services/status.service';
import type { Readiness } from '../services/health.service';
import type { SeatLookup } from './audit';
import { countSeats, isLockLapsed, reportingPercent, seatStatus } from './seat-math';
import { timeAgo } from './time';

export interface LiveSummary {
  total: number;
  declared: number;
  /** Seats with votes and a leader, not declared yet. */
  leading: number;
  /** Seats with no votes yet. */
  pending: number;
  reportingPct: number;
  /** Party leading in the most undeclared seats. */
  topLeader: { party: string; seats: number } | null;
  /** Newest `last_updated` of any candidate with votes. */
  lastUpdate: string | null;
  /** Highest current round reported by any seat. */
  round: number | null;
}

const count = (n: number, word: string) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

/** KPI numbers for the selected election, from GET /admin/elections/:id/live-results. */
export function summarizeLive(seats: LiveConstituency[]): LiveSummary {
  const counts = countSeats(seats);
  const ahead = new Map<string, number>();
  let lastUpdate: string | null = null;
  let lastAt = -Infinity;
  let round: number | null = null;
  for (const s of seats) {
    if (seatStatus(s) === 'LEADING') {
      const lead = s.candidates.find((c) => c.status === 'LEADING');
      if (lead) {
        const party = lead.party_abbr || lead.party_id;
        ahead.set(party, (ahead.get(party) ?? 0) + 1);
      }
    }
    if (s.current_round !== null && (round === null || s.current_round > round)) round = s.current_round;
    for (const c of s.candidates) {
      if (c.votes <= 0) continue;
      const t = Date.parse(c.last_updated);
      if (Number.isFinite(t) && t > lastAt) { lastAt = t; lastUpdate = c.last_updated; }
    }
  }
  let topLeader: LiveSummary['topLeader'] = null;
  for (const [party, n] of ahead) if (!topLeader || n > topLeader.seats) topLeader = { party, seats: n };
  return {
    total: counts.all, declared: counts.WON, leading: counts.LEADING, pending: counts.PENDING,
    reportingPct: reportingPercent(counts), topLeader, lastUpdate, round,
  };
}

/** "BJP ahead in 62 seats". */
export const leadingSubtitle = (s: LiveSummary) =>
  (s.topLeader ? `${s.topLeader.party} ahead in ${count(s.topLeader.seats, 'seat')}` : 'no seat has a leader yet');

/** "2 min ago · Round 4". */
export const lastUpdateSubtitle = (s: LiveSummary, now: number) =>
  (s.lastUpdate ? [timeAgo(s.lastUpdate, now), s.round !== null ? `Round ${s.round}` : null].filter(Boolean).join(' · ') : 'no votes yet');

export interface EditingNow { constId: string; userName: string; seat: string }

/** "Seats being edited now": live (not lapsed) locks, each with its seat's number and name. */
export function editingNow(locks: SeatLock[], seats: LiveConstituency[], now: number): EditingNow[] {
  const byId = new Map(seats.map((s) => [s.const_id, s]));
  return locks
    .filter((l) => !isLockLapsed(l, now))
    .map((l) => {
      const s = byId.get(l.const_id);
      return { constId: l.const_id, userName: l.user_name, seat: s ? `${s.const_no} ${s.const_name}` : l.const_id };
    });
}

/** Seat names for audit sentences (Recent activity). */
export function seatLookup(seats: LiveConstituency[]): SeatLookup {
  const byConst = new Map<string, string>();
  const byResult = new Map<string, { seat: string; candidate: string }>();
  for (const s of seats) {
    const seat = `${s.const_no} ${s.const_name}`;
    byConst.set(s.const_id, seat);
    for (const c of s.candidates) byResult.set(c.result_id, { seat, candidate: c.candidate_name });
  }
  return { seatForConst: (id) => byConst.get(id) ?? null, seatForResult: (id) => byResult.get(id) ?? null };
}

export interface HealthRow { label: string; detail: string; value: string; ok: boolean }
export interface HealthSummary { ok: boolean; rows: HealthRow[] }

/** SUPER_ADMIN: from GET /admin/status. */
export function healthFromStatus(s: SystemStatus): HealthSummary {
  const redisOk = s.redis.pubReady && s.redis.subReady;
  return {
    ok: s.db.ok && redisOk,
    rows: [
      { label: 'Database', detail: 'PostgreSQL', value: s.db.ok ? `OK · ${s.db.latencyMs} ms` : 'Down', ok: s.db.ok },
      { label: 'Redis', detail: 'Cache and pub/sub', value: redisOk ? 'OK' : 'Down', ok: redisOk },
      { label: 'Live updates (SSE)', detail: 'Admin streams', value: count(s.live.sseConnections, 'connection'), ok: true },
      { label: 'Overrides', detail: 'Last 5 min', value: `${s.live.overridesPerMin} / min`, ok: true },
    ],
  };
}

/** Everyone else: from the public GET /health/ready. */
export function healthFromReadiness(r: Readiness): HealthSummary {
  const row = (label: string, detail: string, c: Readiness['checks']['database']): HealthRow => {
    const ok = c.status === 'healthy';
    return { label, detail, value: ok ? `OK · ${c.latencyMs} ms` : 'Down', ok };
  };
  const rows = [row('Database', 'PostgreSQL', r.checks.database), row('Redis', 'Cache and pub/sub', r.checks.redis)];
  return { ok: r.status === 'healthy' && rows.every((x) => x.ok), rows };
}

/** Header suffix: "Bihar VS 2025 · counting in progress". */
export const ELECTION_PHASE: Record<Election['status'], string> = {
  Live: 'counting in progress',
  Upcoming: 'upcoming',
  Finalized: 'final results',
};

export function groupElections(elections: Election[]) {
  return {
    live: elections.filter((e) => e.status === 'Live'),
    upcoming: elections.filter((e) => e.status === 'Upcoming'),
    finalized: elections.filter((e) => e.status === 'Finalized'),
  };
}
