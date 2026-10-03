/**
 * PURE UTILITY: Live Console seat math.
 * Margin convention matches scraper/src/simulation: the leader's margin is its lead over
 * the runner-up; every other candidate's margin is its gap to the leader (always >= 0).
 * NOTA (party_id 'NOTA') is never the leader.
 */
import type { LiveConstituency } from '../types';
import type { OverrideStatus } from './override-validation';

export interface SeatRow {
  result_id: string;
  candidate_id: string;
  candidate_name: string;
  party_id: string;
  party_abbr: string | null;
  party_color: string | null;
  votes: number;
  status: OverrideStatus;
}

export const isNota = (r: Pick<SeatRow, 'party_id'>) => r.party_id === 'NOTA';

/** "61,204" / " 61204 " / "1 20 000" → number; anything not a whole number ≥ 0 → null. */
export function parseVotes(raw: string): number | null {
  const cleaned = raw.replace(/[\s,]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

export function rankSeat(rows: SeatRow[]): { leader: SeatRow | null; runnerUp: SeatRow | null; tie: boolean } {
  const ranked = rows.filter((r) => !isNota(r)).sort((a, b) => b.votes - a.votes);
  const [first, second] = ranked;
  if (!first || first.votes === 0) return { leader: null, runnerUp: second ?? null, tie: false };
  if (second && second.votes === first.votes) return { leader: null, runnerUp: null, tie: true };
  return { leader: first, runnerUp: second ?? null, tie: false };
}

export function seatMargin(rows: SeatRow[]): number {
  const { leader, runnerUp } = rankSeat(rows);
  if (!leader) return 0;
  return leader.votes - (runnerUp?.votes ?? 0);
}

/** Statuses implied by the votes. `declared` turns LEADING/TRAILING into WON/LOST. */
export function deriveStatuses(rows: SeatRow[], declared: boolean): SeatRow[] {
  const { leader } = rankSeat(rows);
  return rows.map((r) => {
    const isLeader = leader !== null && r.result_id === leader.result_id;
    const status: OverrideStatus = isLeader ? (declared ? 'WON' : 'LEADING') : declared && leader ? 'LOST' : 'TRAILING';
    return { ...r, status };
  });
}

/** Seat-level status for the list and the filter chips. */
export function seatStatus(c: LiveConstituency): 'PENDING' | 'LEADING' | 'WON' {
  if (c.candidates.some((x) => x.status === 'WON')) return 'WON';
  if (c.candidates.every((x) => x.votes === 0)) return 'PENDING';
  return 'LEADING';
}

/** Mirrors the backend SEAT_LOCK_TTL_SECONDS: an older lock has lapsed (heartbeats re-publish a fresh acquired_at). */
export const SEAT_LOCK_TTL_MS = 120_000;

/** The lock is older than the TTL. An unparseable acquired_at never lapses (the server decides). */
export function isLockLapsed(lock: { acquired_at: string }, now: number): boolean {
  const t = Date.parse(lock.acquired_at);
  return Number.isFinite(t) && now - t > SEAT_LOCK_TTL_MS;
}

export interface SeatCounts { all: number; PENDING: number; LEADING: number; WON: number }

/** Seats per status, for the filter chips and the Dashboard KPIs. */
export function countSeats(seats: LiveConstituency[]): SeatCounts {
  const out: SeatCounts = { all: seats.length, PENDING: 0, LEADING: 0, WON: 0 };
  seats.forEach((s) => { out[seatStatus(s)]++; });
  return out;
}

/** % of seats with any votes (leading or declared), rounded. */
export function reportingPercent(counts: SeatCounts): number {
  return counts.all === 0 ? 0 : Math.round(((counts.LEADING + counts.WON) / counts.all) * 100);
}
