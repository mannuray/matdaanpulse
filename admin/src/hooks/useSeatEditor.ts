import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveConstituency } from '../types';
import type { OverrideStatus } from '../utils/override-validation';
import { deriveStatuses, parseVotes, rankSeat, seatMargin, type SeatRow } from '../utils/seat-math';
import type { SeatSave, SeatStateName } from './useLiveConsole';

type DraftRow = SeatRow & { draftVotes: string };
type BuildResult = { ok: true; save: SeatSave } | { ok: false; error: string };

const VOTE_ERROR = 'Whole number of 0 or more';

function fromServer(seat: LiveConstituency | null): DraftRow[] {
  return (seat?.candidates ?? []).map((c) => ({
    result_id: c.result_id, candidate_id: c.candidate_id, candidate_name: c.candidate_name, party_id: c.party_id,
    party_abbr: c.party_abbr, party_color: c.party_color, votes: c.votes, status: c.status as OverrideStatus,
    draftVotes: String(c.votes),
  }));
}
const roundOf = (s: LiveConstituency | null) => ({ current: s?.current_round?.toString() ?? '', total: s?.total_rounds?.toString() ?? '' });
const stateOf = (s: LiveConstituency | null): SeatStateName => (s?.candidates.some((c) => c.status === 'WON') ? 'declared' : 'counting');
const fingerprint = (s: LiveConstituency | null) =>
  s ? `${s.const_id}|${s.current_round}|${s.total_rounds}|${s.candidates.map((c) => `${c.result_id}:${c.votes}:${c.status}`).join(',')}` : '';

/** Draft state for the Live Console seat editor. Never loses unsaved edits to a background reload. */
export function useSeatEditor(seat: LiveConstituency | null) {
  const [rows, setRows] = useState<DraftRow[]>(() => fromServer(seat));
  const [round, setRoundState] = useState(() => roundOf(seat));
  const [dirty, setDirty] = useState(false);
  const [seatState, setSeatStateRaw] = useState<SeatStateName>(() => stateOf(seat));
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const seen = useRef({ id: seat?.const_id ?? '', print: fingerprint(seat) });
  const latest = useRef(seat);
  latest.current = seat;

  const reset = useCallback((s: LiveConstituency | null) => {
    setRows(fromServer(s));
    setRoundState(roundOf(s));
    setDirty(false);
    setSeatStateRaw(stateOf(s));
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
  const serverWinnerId = useMemo(() => (seat?.candidates ?? []).find((c) => c.status === 'WON')?.result_id ?? null, [seat]);

  const setVotes = useCallback((resultId: string, raw: string) => {
    setDirty(true);
    setRows((prev) => prev.map((r) => (r.result_id === resultId ? { ...r, draftVotes: raw, votes: parseVotes(raw) ?? r.votes } : r)));
  }, []);

  const setSeatState = useCallback((next: SeatStateName) => {
    setDirty(true);
    setSeatStateRaw(next);
  }, []);

  const setRound = useCallback((field: 'current' | 'total', raw: string) => {
    setDirty(true);
    setRoundState((prev) => ({ ...prev, [field]: raw }));
  }, []);

  const discard = useCallback(() => reset(latest.current), [reset]);

  /** Our own save succeeded: keep what is on screen, and let the follow-up reload replace it silently. */
  const markSaved = useCallback(() => {
    setDirty(false);
    setChangedElsewhere(false);
  }, []);

  const view = useMemo(() => {
    // Statuses are derived by the server; this is a read-only preview of what it will store.
    const preview = deriveStatuses(rows, seatState === 'declared');
    const withErrors = rows.map((r, i) => ({ ...r, status: preview[i].status, error: parseVotes(r.draftVotes) === null ? VOTE_ERROR : null }));
    const { leader, tie } = rankSeat(rows);
    return {
      rows: withErrors,
      leaderId: leader?.result_id ?? null,
      tie,
      margin: seatMargin(rows),
      totalVotes: rows.reduce((sum, r) => sum + r.votes, 0),
      winnerNotLeader: serverWinnerId !== null && (leader?.result_id ?? null) !== serverWinnerId,
    };
  }, [rows, seatState, serverWinnerId]);

  const build = useCallback((declare: boolean): BuildResult => {
    if (view.rows.some((r) => r.error)) return { ok: false, error: 'Fix the highlighted votes' };
    const cur = round.current.trim(), tot = round.total.trim();
    if ((cur === '') !== (tot === '')) return { ok: false, error: 'Fill both round fields or neither' };
    let r: { current: number; total: number } | null = null;
    if (cur !== '') {
      const c = parseVotes(cur), t = parseVotes(tot);
      if (c === null || t === null) return { ok: false, error: 'Rounds must be whole numbers' };
      if (c > t) return { ok: false, error: 'Current round cannot exceed total rounds' };
      r = { current: c, total: t };
    }
    const votes = Object.fromEntries(rows.map((x) => [x.candidate_id, x.votes]));
    return { ok: true, save: { state: declare ? 'declared' : seatState, round: r, votes } };
  }, [view.rows, rows, round, seatState]);

  return { ...view, round, dirty, changedElsewhere, declared, seatState, setSeatState, setVotes, setRound, discard, markSaved, build };
}
