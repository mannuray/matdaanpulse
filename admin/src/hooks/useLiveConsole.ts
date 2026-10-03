import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLiveResults, getSeatLocks, subscribeLiveUpdates } from '../services/election.service';
import { correctSeat, getHolds, releaseHold as releaseHoldRequest } from '../services/ingest.service';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { useToast } from '../context/ToastContext';
import { countSeats, isLockLapsed, reportingPercent, seatStatus, SEAT_LOCK_TTL_MS } from '../utils/seat-math';
import type { HoldRow, LiveConstituency, SeatLock } from '../types';

const FLASH_MS = 1500;
const RELOAD_DEBOUNCE_MS = 500;
/** Kept for existing imports; the constant now lives in utils/seat-math. */
export { SEAT_LOCK_TTL_MS };
const LOCK_SWEEP_MS = 15_000;

export type SeatFilter = 'all' | 'PENDING' | 'LEADING' | 'WON';
export type SeatStateName = 'not_started' | 'counting' | 'declared' | 'countermanded' | 'adjourned';
export interface SeatSave { state: SeatStateName; round: { current: number; total: number } | null; votes: Record<string, number> }

/** CONTROLLER: Live Console — seats, filters, selection, live stream, seat locks, save. */
export function useLiveConsole(opts?: { holdSelection?: boolean }) {
  const holdSelection = !!opts?.holdSelection;
  const { electionId, election, error: electionsError } = useElection();
  // Responses for an election the user has already left must not land on the new one.
  const electionRef = useRef(electionId);
  electionRef.current = electionId;
  const { setLive } = useShellStatus();
  const toasts = useToast();
  // Held in a ref so callbacks/effects don't re-run if a provider hands out new toast fns.
  const toastRef = useRef(toasts);
  toastRef.current = toasts;

  const [all, setAll] = useState<LiveConstituency[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<SeatFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rawLocks, setLocks] = useState<Record<string, SeatLock>>({});
  const [now, setNow] = useState(() => Date.now());
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [lastSavedAt, setLastSavedAt] = useState<Record<string, string>>({});
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [holdUntil, setHoldUntil] = useState<Record<string, string>>({});

  const load = useCallback(async (silent = false) => {
    if (!electionId) return;
    const current = () => electionRef.current === electionId;
    if (!silent) setLoading(true);
    try {
      const seats = await getLiveResults(electionId);
      if (current()) setAll(seats);
    } catch {
      if (!silent && current()) toastRef.current.toast('Failed to load live results', 'error');
    } finally {
      if (!silent && current()) setLoading(false);
    }
  }, [electionId]);

  const loadLocks = useCallback(async () => {
    if (!electionId) return;
    try {
      const list = await getSeatLocks(electionId);
      if (electionRef.current === electionId) setLocks(Object.fromEntries(list.map((l) => [l.const_id, l])));
    } catch {
      if (electionRef.current === electionId) setLocks({}); // locking unavailable — the editor shows it per seat
    }
  }, [electionId]);

  const loadHolds = useCallback(async () => {
    if (!electionId) return;
    try {
      const list = await getHolds(electionId);
      if (electionRef.current === electionId) setHolds(list);
    } catch {
      // keep the last list: a failed refresh must not hide holds that still exist
    }
  }, [electionId]);

  // Re-check lock ages periodically so a lapsed lock disappears even when no event arrives.
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); void loadHolds(); }, LOCK_SWEEP_MS);
    return () => clearInterval(t);
  }, [loadHolds]);
  const locks = useMemo(() => {
    const entries = Object.entries(rawLocks).filter(([, l]) => !isLockLapsed(l, now));
    return entries.length === Object.keys(rawLocks).length ? rawLocks : Object.fromEntries(entries);
  }, [rawLocks, now]);

  useEffect(() => { setSelectedId(null); setHolds([]); setHoldUntil({}); void load(); void loadLocks(); void loadHolds(); }, [load, loadLocks, loadHolds]);

  useEffect(() => {
    if (!electionId) return;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const flashTimers = new Set<ReturnType<typeof setTimeout>>();
    const flash = (ids: string[]) => {
      if (ids.length === 0) return;
      setFlashIds((prev) => new Set([...prev, ...ids]));
      const t = setTimeout(() => {
        flashTimers.delete(t);
        setFlashIds((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
      }, FLASH_MS);
      flashTimers.add(t);
    };
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => { reloadTimer = null; void load(true); }, RELOAD_DEBOUNCE_MS);
    };
    const unsubscribe = subscribeLiveUpdates(electionId, {
      onStatus: setLive,
      onReconnect: () => { scheduleReload(); void loadLocks(); void loadHolds(); },
      onResultUpdate: (u) => { flash([u.const_id]); scheduleReload(); },
      onBatchUpdate: (us) => { flash(us.map((u) => u.const_id)); scheduleReload(); },
      onSeatLock: ({ const_id, lock }) => setLocks((prev) => {
        const next = { ...prev };
        if (lock) next[const_id] = lock; else delete next[const_id];
        return next;
      }),
    });
    return () => {
      unsubscribe();
      setLive('idle');
      if (reloadTimer) clearTimeout(reloadTimer);
      flashTimers.forEach(clearTimeout);
    };
  }, [electionId, load, loadLocks, loadHolds, setLive]);

  const counts = useMemo(() => countSeats(all), [all]);

  const seats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((c) => filter === 'all' || seatStatus(c) === filter)
      .filter((c) => !q || String(c.const_no).startsWith(q) || c.const_name.toLowerCase().includes(q))
      .sort((a, b) => a.const_no - b.const_no);
  }, [all, filter, search]);

  // Keep a valid selection inside the visible list.
  useEffect(() => {
    if (holdSelection && selectedId && all.some((s) => s.const_id === selectedId)) return; // unsaved edits: keep the seat
    if (seats.length === 0) { if (selectedId !== null) setSelectedId(null); return; }
    if (!selectedId || !seats.some((s) => s.const_id === selectedId)) setSelectedId(seats[0].const_id);
  }, [seats, selectedId, holdSelection, all]);

  const move = useCallback((delta: 1 | -1) => {
    setSelectedId((cur) => {
      const i = seats.findIndex((s) => s.const_id === cur);
      const next = seats[Math.min(seats.length - 1, Math.max(0, i + delta))];
      return next ? next.const_id : cur;
    });
  }, [seats]);

  const saveSeat = useCallback(async (constId: string, payload: SeatSave) => {
    setSaving(true);
    try {
      const res = await correctSeat(electionId, constId, payload);
      if (res?.hold_expires_at) setHoldUntil((prev) => ({ ...prev, [constId]: res.hold_expires_at }));
      setLastSavedAt((prev) => ({ ...prev, [constId]: new Date().toISOString() }));
      toastRef.current.toast('Seat saved');
      await load(true);
      await loadHolds();
      return true;
    } catch (err) {
      toastRef.current.toastError(err, 'Failed to save seat');
      return false;
    } finally {
      setSaving(false);
    }
  }, [electionId, load, loadHolds]);

  const releaseHold = useCallback(async (constId: string) => {
    try {
      await releaseHoldRequest(electionId, constId);
      setHoldUntil((prev) => { const n = { ...prev }; delete n[constId]; return n; });
      toastRef.current.toast('Hold released');
    } catch (err) {
      toastRef.current.toastError(err, 'Failed to release hold');
    }
    await loadHolds();
  }, [electionId, loadHolds]);

  const reportingPct = reportingPercent(counts);

  return {
    electionId, electionName: election?.name ?? '', electionsError, loading, saving,
    seats, counts, filter, setFilter, search, setSearch,
    selectedId, selected: all.find((s) => s.const_id === selectedId) ?? null, select: setSelectedId, move,
    locks, flashIds, reportingPct, saveSeat, lastSavedAt, holds, releaseHold, holdUntil,
  };
}
