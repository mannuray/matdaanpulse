import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveConstituency } from '../types';
import type { OverrideStatus } from '../utils/override-validation';
import { buildSeatOverrides, deriveStatuses, parseVotes, rankSeat, seatMargin, type BulkOverrideItem, type SeatRow } from '../utils/seat-math';

type DraftRow = SeatRow & { draftVotes: string };
type BuildResult =
  | { ok: true; overrides: BulkOverrideItem[]; rounds?: { current_round?: number; total_rounds?: number } }
  | { ok: false; error: string };

const VOTE_ERROR = 'Whole number of 0 or more';

function fromServer(seat: LiveConstituency | null): DraftRow[] {
  return (seat?.candidates ?? []).map((c) => ({
    result_id: c.result_id, candidate_id: c.candidate_id, candidate_name: c.candidate_name, party_id: c.party_id,
    party_abbr: c.party_abbr, party_color: c.party_color, votes: c.votes, status: c.status as OverrideStatus,
    draftVotes: String(c.votes),
  }));
}
const roundOf = (s: LiveConstituency | null) => ({ current: s?.current_round?.toString() ?? '', total: s?.total_rounds?.toString() ?? '' });
const fingerprint = (s: LiveConstituency | null) =>
  s ? `${s.const_id}|${s.current_round}|${s.total_rounds}|${s.candidates.map((c) => `${c.result_id}:${c.votes}:${c.status}`).join(',')}` : '';

/** Draft state for the Live Console seat editor. Never loses unsaved edits to a background reload. */
export function useSeatEditor(seat: LiveConstituency | null) {
  const [rows, setRows] = useState<DraftRow[]>(() => fromServer(seat));
  const [round, setRoundState] = useState(() => roundOf(seat));
  const [dirty, setDirty] = useState(false);
  const [statusTouched, setStatusTouched] = useState(false);
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const seen = useRef({ id: seat?.const_id ?? '', print: fingerprint(seat) });
  const latest = useRef(seat);
  latest.current = seat;

  const reset = useCallback((s: LiveConstituency | null) => {
    setRows(fromServer(s));
    setRoundState(roundOf(s));
    setDirty(false);
    setStatusTouched(false);
    setChangedElsewhere(false);
    seen.current = { id: s?.const_id ?? '', print: fingerprint(s) };
  }, []);

  useEffect(() => {
    const id = seat?.const_id ?? '';
    const print = fingerprint(seat);
    if (id !== seen.current.id) return reset(seat);
    if (print === seen.current.print) return;
    if (dirty) setChangedElsewhere(true);
    else reset(seat);
  }, [seat, dirty, reset]);

  const declared = useMemo(() => (seat?.candidates ?? []).some((c) => c.status === 'WON'), [seat]);

  const setVotes = useCallback((resultId: string, raw: string) => {
    setDirty(true);
    setRows((prev) => {
      const next = prev.map((r) => (r.result_id === resultId ? { ...r, draftVotes: raw, votes: parseVotes(raw) ?? r.votes } : r));
      if (statusTouched) return next;
      const derived = deriveStatuses(next, declared);
      return next.map((r, i) => ({ ...r, status: derived[i].status }));
    });
  }, [statusTouched, declared]);

  const setStatus = useCallback((resultId: string, status: OverrideStatus) => {
    setDirty(true);
    setStatusTouched(true);
    setRows((prev) => prev.map((r) => (r.result_id === resultId ? { ...r, status } : r)));
  }, []);

  const setRound = useCallback((field: 'current' | 'total', raw: string) => {
    setDirty(true);
    setRoundState((prev) => ({ ...prev, [field]: raw }));
  }, []);

  const discard = useCallback(() => reset(latest.current), [reset]);

  /** Our own save succeeded: keep what is on screen, and let the follow-up reload replace it silently. */
  const markSaved = useCallback(() => {
    setDirty(false);
    setStatusTouched(false);
    setChangedElsewhere(false);
  }, []);

  const view = useMemo(() => {
    const withErrors = rows.map((r) => ({ ...r, error: parseVotes(r.draftVotes) === null ? VOTE_ERROR : null }));
    const { leader, tie } = rankSeat(rows);
    return {
      rows: withErrors,
      leaderId: leader?.result_id ?? null,
      tie,
      margin: seatMargin(rows),
      totalVotes: rows.reduce((sum, r) => sum + r.votes, 0),
    };
  }, [rows]);

  const build = useCallback((declare: boolean): BuildResult => {
    if (view.rows.some((r) => r.error)) return { ok: false, error: 'Fix the highlighted votes' };
    const parsedRound = { current: round.current.trim(), total: round.total.trim() };
    const cur = parsedRound.current === '' ? undefined : parseVotes(parsedRound.current);
    const tot = parsedRound.total === '' ? undefined : parseVotes(parsedRound.total);
    if (cur === null || tot === null) return { ok: false, error: 'Rounds must be whole numbers' };
    if (cur !== undefined && tot !== undefined && cur > tot) return { ok: false, error: 'Current round cannot exceed total rounds' };
    const finalRows = declare ? deriveStatuses(rows, true) : rows;
    const rounds = cur !== undefined || tot !== undefined ? { current_round: cur, total_rounds: tot } : undefined;
    return { ok: true, overrides: buildSeatOverrides(finalRows), ...(rounds ? { rounds } : {}) };
  }, [view.rows, rows, round]);

  return { ...view, round, dirty, changedElsewhere, declared, setVotes, setStatus, setRound, discard, markSaved, build };
}
