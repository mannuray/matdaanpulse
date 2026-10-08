import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSeatLocks } from '../../services/election.service';
import { isLockLapsed } from '../../utils/seat-math';
import type { SeatLock } from '../../types';

const LOCK_SWEEP_MS = 15_000;

/** Who is editing which seat: loaded, updated from the live stream, and swept so a lapsed lock disappears without an event. */
export function useSeatLocks(electionId: string) {
  const [rawLocks, setLocks] = useState<Record<string, SeatLock>>({});
  const [now, setNow] = useState(() => Date.now());
  const electionRef = useRef(electionId);
  electionRef.current = electionId;

  const loadLocks = useCallback(async () => {
    if (!electionId) return;
    try {
      const list = await getSeatLocks(electionId);
      if (electionRef.current === electionId) setLocks(Object.fromEntries(list.map((l) => [l.const_id, l])));
    } catch {
      if (electionRef.current === electionId) setLocks({}); // locking unavailable — the editor shows it per seat
    }
  }, [electionId]);

  useEffect(() => { void loadLocks(); }, [loadLocks]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), LOCK_SWEEP_MS);
    return () => clearInterval(t);
  }, []);

  const applyLockEvent = useCallback((constId: string, lock: SeatLock | null) => setLocks((prev) => {
    const next = { ...prev };
    if (lock) next[constId] = lock; else delete next[constId];
    return next;
  }), []);

  const locks = useMemo(() => {
    const entries = Object.entries(rawLocks).filter(([, l]) => !isLockLapsed(l, now));
    return entries.length === Object.keys(rawLocks).length ? rawLocks : Object.fromEntries(entries);
  }, [rawLocks, now]);

  return { locks, loadLocks, applyLockEvent };
}
