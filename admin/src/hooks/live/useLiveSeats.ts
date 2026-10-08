import { useCallback, useEffect, useRef, useState } from 'react';
import { getLiveResults, subscribeLiveUpdates } from '../../services/live.service';
import { useShellStatus } from '../../context/ShellStatusContext';
import { useToast } from '../../context/ToastContext';
import type { LiveConstituency, SeatLock } from '../../types';

const FLASH_MS = 1500;
const RELOAD_DEBOUNCE_MS = 500;

/**
 * The election's seats for the Live Console: loaded, reloaded (debounced) on live updates, with the changed seats
 * flashing. Lock events and reconnects are handed to the caller (locks and holds live in their own hooks).
 */
export function useLiveSeats(electionId: string, on: { seatLock(constId: string, lock: SeatLock | null): void; reconnect(): void }) {
  const [all, setAll] = useState<LiveConstituency[]>([]);
  const [loading, setLoading] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const { setLive } = useShellStatus();
  const toastRef = useRef(useToast());
  const onRef = useRef(on);
  onRef.current = on;
  // Responses for an election the user has already left must not land on the new one.
  const electionRef = useRef(electionId);
  electionRef.current = electionId;

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

  useEffect(() => { void load(); }, [load]);

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
      onReconnect: () => { scheduleReload(); onRef.current.reconnect(); },
      onResultUpdate: (u) => { flash([u.const_id]); scheduleReload(); },
      onBatchUpdate: (us) => { flash(us.map((u) => u.const_id)); scheduleReload(); },
      onSeatLock: ({ const_id, lock }) => onRef.current.seatLock(const_id, lock),
    });
    return () => {
      unsubscribe();
      setLive('idle');
      if (reloadTimer) clearTimeout(reloadTimer);
      flashTimers.forEach(clearTimeout);
    };
  }, [electionId, load, setLive]);

  return { all, loading, load, flashIds };
}
