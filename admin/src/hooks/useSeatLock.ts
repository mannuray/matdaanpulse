import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireSeatLock, releaseSeatLock } from '../services/election.service';
import { ApiError } from '../services/api-client';
import type { SeatLock } from '../types';

export const LOCK_HEARTBEAT_MS = 45_000;
/** Wait for the selection to settle, so holding ↓ does not lock (and broadcast) every seat passed. */
export const LOCK_ACQUIRE_DEBOUNCE_MS = 300;
export type SeatLockState = 'idle' | 'acquiring' | 'held' | 'locked' | 'unavailable';

/** Soft lock for the seat open in the Live Console editor. Advisory: saving never depends on it. */
export function useSeatLock(electionId: string, constId: string | null, myUserId: string, remoteLock: SeatLock | null | undefined) {
  const [state, setState] = useState<SeatLockState>('idle');
  const [holder, setHolder] = useState<SeatLock | null>(null);
  const heldRef = useRef<{ e: string; c: string } | null>(null);
  const currentRef = useRef({ e: electionId, c: constId });
  currentRef.current = { e: electionId, c: constId };

  const genRef = useRef(0);
  const mineRef = useRef<SeatLock | null>(null);

  const attempt = useCallback(async (e: string, c: string, takeOver: boolean, isHeartbeat = false) => {
    const gen = genRef.current;
    const stale = () => genRef.current !== gen || currentRef.current.e !== e || currentRef.current.c !== c;
    try {
      const l = await acquireSeatLock(e, c, takeOver);
      if (stale()) { void releaseSeatLock(e, c, undefined).catch(() => {}); return; }
      heldRef.current = { e, c };
      mineRef.current = l;
      setHolder(l);
      setState('held');
    } catch (err) {
      if (stale()) return;
      const conflict = err instanceof ApiError && err.status === 409;
      if (isHeartbeat && !conflict) return; // transient: keep ownership, next interval retries
      heldRef.current = null;
      mineRef.current = null;
      if (conflict) {
        setHolder((err.details?.lock as SeatLock | undefined) ?? null);
        setState('locked');
      } else {
        setHolder(null);
        setState('unavailable');
      }
    }
  }, []);

  // Acquire once the seat change settles; release the previous seat on change/unmount.
  useEffect(() => {
    if (!electionId || !constId) { setState('idle'); setHolder(null); return; }
    setState('acquiring');
    setHolder(null);
    const t = setTimeout(() => { void attempt(electionId, constId, false); }, LOCK_ACQUIRE_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      genRef.current += 1;
      const h = heldRef.current;
      heldRef.current = null;
      mineRef.current = null;
      if (h) void releaseSeatLock(h.e, h.c, undefined).catch(() => {});
    };
  }, [electionId, constId, attempt]);

  // Heartbeat while held.
  useEffect(() => {
    if (state !== 'held' || !constId) return;
    const t = setInterval(() => { void attempt(electionId, constId, false, true); }, LOCK_HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [state, electionId, constId, attempt]);

  // Tab closing: best-effort keepalive release (the TTL covers the rest).
  useEffect(() => {
    const onHide = () => {
      const h = heldRef.current;
      if (h) void releaseSeatLock(h.e, h.c, { keepalive: true }).catch(() => {});
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  // Someone took the seat over (SSE) → we are now read-only.
  useEffect(() => {
    // Ignore a stale remote lock (older than ours, e.g. the previous holder before our take-over).
    const mine = mineRef.current;
    if (state === 'held' && remoteLock && remoteLock.user_id !== myUserId && (!mine || remoteLock.acquired_at >= mine.acquired_at)) {
      heldRef.current = null;
      mineRef.current = null;
      setHolder(remoteLock);
      setState('locked');
    }
  }, [remoteLock, myUserId, state]);

  const takeOver = useCallback(async () => {
    if (electionId && constId) await attempt(electionId, constId, true);
  }, [electionId, constId, attempt]);
  return { state, holder, takeOver };
}
