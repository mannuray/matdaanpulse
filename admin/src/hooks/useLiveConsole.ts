import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bulkOverride, getLiveResults, getSeatLocks, subscribeLiveUpdates } from '../services/election.service';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { useToast } from '../context/ToastContext';
import { seatStatus, type BulkOverrideItem } from '../utils/seat-math';
import type { LiveConstituency, SeatLock } from '../types';

const FLASH_MS = 1500;
const RELOAD_DEBOUNCE_MS = 500;

export type SeatFilter = 'all' | 'PENDING' | 'LEADING' | 'WON';
export interface SeatSave {
  overrides: BulkOverrideItem[];
  rounds?: { current_round?: number; total_rounds?: number };
}

/** CONTROLLER: Live Console — seats, filters, selection, live stream, seat locks, save. */
export function useLiveConsole() {
  const { electionId, election } = useElection();
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
  const [locks, setLocks] = useState<Record<string, SeatLock>>({});
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [lastSavedAt, setLastSavedAt] = useState<Record<string, string>>({});

  const load = useCallback(async (silent = false) => {
    if (!electionId) return;
    if (!silent) setLoading(true);
    try {
      setAll(await getLiveResults(electionId));
    } catch {
      if (!silent) toastRef.current.toast('Failed to load live results', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [electionId]);

  const loadLocks = useCallback(async () => {
    if (!electionId) return;
    try {
      const list = await getSeatLocks(electionId);
      setLocks(Object.fromEntries(list.map((l) => [l.const_id, l])));
    } catch {
      setLocks({}); // locking unavailable — the editor shows it per seat
    }
  }, [electionId]);

  useEffect(() => { setSelectedId(null); void load(); void loadLocks(); }, [load, loadLocks]);

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
      onReconnect: () => { scheduleReload(); void loadLocks(); },
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
  }, [electionId, load, loadLocks, setLive]);

  const counts = useMemo(() => {
    const out = { all: all.length, PENDING: 0, LEADING: 0, WON: 0 };
    all.forEach((c) => { out[seatStatus(c)]++; });
    return out;
  }, [all]);

  const seats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((c) => filter === 'all' || seatStatus(c) === filter)
      .filter((c) => !q || String(c.const_no).startsWith(q) || c.const_name.toLowerCase().includes(q))
      .sort((a, b) => a.const_no - b.const_no);
  }, [all, filter, search]);

  // Keep a valid selection inside the visible list.
  useEffect(() => {
    if (seats.length === 0) { if (selectedId !== null) setSelectedId(null); return; }
    if (!selectedId || !seats.some((s) => s.const_id === selectedId)) setSelectedId(seats[0].const_id);
  }, [seats, selectedId]);

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
      await bulkOverride(electionId, payload.overrides, payload.rounds ? { [constId]: payload.rounds } : undefined);
      setLastSavedAt((prev) => ({ ...prev, [constId]: new Date().toISOString() }));
      toastRef.current.toast('Seat saved');
      await load(true);
      return true;
    } catch (err) {
      toastRef.current.toastError(err, 'Failed to save seat');
      return false;
    } finally {
      setSaving(false);
    }
  }, [electionId, load]);

  const reportingPct = all.length === 0 ? 0 : Math.round(((counts.LEADING + counts.WON) / all.length) * 100);

  return {
    electionId, electionName: election?.name ?? '', loading, saving,
    seats, counts, filter, setFilter, search, setSearch,
    selectedId, selected: all.find((s) => s.const_id === selectedId) ?? null, select: setSelectedId, move,
    locks, flashIds, reportingPct, saveSeat, lastSavedAt,
  };
}
