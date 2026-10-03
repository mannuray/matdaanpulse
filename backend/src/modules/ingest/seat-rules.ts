// backend/src/modules/ingest/seat-rules.ts
/**
 * The ingest rules for one seat (spec §4.4), pure so every rule is unit-tested: roster check, freshness, hold,
 * derived statuses / margin, change detection. The service (ingest.service.ts) only loads state and writes.
 */
export const SEAT_STATES = ['not_started', 'counting', 'declared', 'countermanded', 'adjourned'] as const;
export type SeatState = (typeof SEAT_STATES)[number];
export type ResultStatus = 'LEADING' | 'WON' | 'TRAILING' | 'LOST';
export interface RosterCandidate { candidate_id: string; party_id: string | null }
export interface IncomingSeat { const_id: string; state: SeatState; round?: { current: number; total: number } | null; votes: Record<string, number> }
export interface StoredRow { candidate_id: string; votes: number; status: ResultStatus; margin: number | null }
export interface StoredSeat { state: SeatState | null; round_current: number | null; round_total: number | null; last_source: string | null; last_observed_at: Date | null }
export interface Hold { round_at_hold: number | null; expires_at: Date }
export interface DerivedRow { candidate_id: string; votes: number; status: ResultStatus; margin: number }
export type SeatOutcome =
  | { kind: 'applied'; rows: DerivedRow[]; releaseHold: boolean }
  | { kind: 'unchanged'; releaseHold: boolean }
  | { kind: 'stale' }
  | { kind: 'held' }
  | { kind: 'rejected'; reason: string; detail?: Record<string, unknown> };

const isNota = (c: RosterCandidate) => c.party_id === 'NOTA';
/** results.votes / round columns are INT. */
export const PG_INT_MAX = 2_147_483_647;

/** Rule 2: exactly the roster's candidates, whole non-negative votes, a sane round. */
export function checkRoster(seat: IncomingSeat, roster: RosterCandidate[]): { reason: string; detail?: Record<string, unknown> } | null {
  const want = new Set(roster.map(c => c.candidate_id));
  const got = Object.keys(seat.votes);
  const missing = [...want].filter(id => !(id in seat.votes));
  const unknown = got.filter(id => !want.has(id));
  if (missing.length || unknown.length) return { reason: 'roster_mismatch', detail: { missing, unknown } };
  if (got.some(id => !Number.isInteger(seat.votes[id]) || seat.votes[id] < 0 || seat.votes[id] > PG_INT_MAX)) return { reason: 'invalid_votes' };
  const r = seat.round;
  if (r && (!Number.isInteger(r.current) || !Number.isInteger(r.total) || r.current < 0 || r.total < 0 || r.current > r.total || r.total > PG_INT_MAX)) return { reason: 'invalid_round' };
  return null;
}

/** Every roster candidate needs a results row: the write is an UPDATE, so a missing row would silently drop that candidate's votes. */
export function missingResultRows(roster: RosterCandidate[], storedRows: StoredRow[]): string[] {
  const have = new Set(storedRows.map(r => r.candidate_id));
  return roster.filter(c => !have.has(c.candidate_id)).map(c => c.candidate_id);
}

/** Rule 3. */
export function isStale(seat: IncomingSeat, stored: StoredSeat | null, source: string, observedAt: Date): boolean {
  if (!stored) return false;
  if (stored.state === 'declared' && seat.state !== 'declared') return true;
  const cur = seat.round?.current ?? null;
  if (cur !== null && stored.round_current !== null) {
    if (cur < stored.round_current) return true;
    if (cur > stored.round_current) return false;
  }
  // Same (or unknown) round: only the same source's clock is comparable.
  return stored.last_source === source && !!stored.last_observed_at && observedAt < stored.last_observed_at;
}

/** Rule 4. */
export function holdDecision(seat: IncomingSeat, hold: Hold | null, now: Date): 'none' | 'release' | 'keep' {
  if (!hold) return 'none';
  if (now >= hold.expires_at) return 'release';
  const cur = seat.round?.current;
  if (cur != null && hold.round_at_hold != null && cur > hold.round_at_hold) return 'release';
  return 'keep';
}

/** Rule 5: statuses and margin from votes; roster order kept. */
export function deriveRows(seat: IncomingSeat, roster: RosterCandidate[]): DerivedRow[] | { reason: 'declared_tie' } {
  const ranked = roster.filter(c => !isNota(c)).map(c => ({ id: c.candidate_id, v: seat.votes[c.candidate_id] })).sort((a, b) => b.v - a.v);
  const top = ranked[0], second = ranked[1];
  const margin = top ? top.v - (second?.v ?? 0) : 0;
  const hasLeader = (seat.state === 'counting' || seat.state === 'declared') && !!top && top.v > 0 && (!second || top.v > second.v);
  if (seat.state === 'declared' && !hasLeader) return { reason: 'declared_tie' };
  const won = seat.state === 'declared';
  return roster.map(c => {
    const lead = hasLeader && c.candidate_id === top.id;
    const status: ResultStatus = won ? (lead ? 'WON' : 'LOST') : lead ? 'LEADING' : 'TRAILING';
    return { candidate_id: c.candidate_id, votes: seat.votes[c.candidate_id], status, margin };
  });
}

/** Rule 6. A seat sent without a round keeps the stored round (the write COALESCEs it), so it compares on the rest. */
export function sameAsStored(rows: DerivedRow[], seat: IncomingSeat, storedRows: StoredRow[], stored: StoredSeat | null): boolean {
  if (!stored || stored.state !== seat.state) return false;
  if (seat.round && (seat.round.current !== stored.round_current || seat.round.total !== stored.round_total)) return false;
  const byId = new Map(storedRows.map(r => [r.candidate_id, r]));
  return rows.every(r => {
    const s = byId.get(r.candidate_id);
    return !!s && s.votes === r.votes && s.status === r.status && (s.margin ?? 0) === r.margin;
  });
}

/** Rules 2–6 in order for one seat (plus the results-row check after rule 2) (rule 1, the shard check, is the service's). */
export function evaluateSeat(a: { seat: IncomingSeat; roster: RosterCandidate[]; stored: StoredSeat | null; storedRows: StoredRow[]; hold: Hold | null; source: string; observedAt: Date; now: Date }): SeatOutcome {
  const bad = checkRoster(a.seat, a.roster);
  if (bad) return { kind: 'rejected', ...bad };
  const missing = missingResultRows(a.roster, a.storedRows);
  if (missing.length) return { kind: 'rejected', reason: 'missing_result_rows', detail: { missing } };
  if (isStale(a.seat, a.stored, a.source, a.observedAt)) return { kind: 'stale' };
  const hold = holdDecision(a.seat, a.hold, a.now);
  if (hold === 'keep') return { kind: 'held' };
  const rows = deriveRows(a.seat, a.roster);
  if (!Array.isArray(rows)) return { kind: 'rejected', reason: rows.reason };
  const releaseHold = hold === 'release';
  if (sameAsStored(rows, a.seat, a.storedRows, a.stored)) return { kind: 'unchanged', releaseHold };
  return { kind: 'applied', rows, releaseHold };
}
