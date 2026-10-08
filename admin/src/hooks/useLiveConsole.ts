import { useCallback, useMemo, useRef, useState } from 'react';
import { correctSeat } from '../services/ingest.service';
import { useElection } from '../context/ElectionContext';
import { useToast } from '../context/ToastContext';
import { countSeats, reportingPercent, SEAT_LOCK_TTL_MS } from '../utils/seat-math';
import type { SeatStateName } from '../types';
import { useHolds } from './live/useHolds';
import { useSeatLocks } from './live/useSeatLocks';
import { useLiveSeats } from './live/useLiveSeats';
import { useSeatSelection } from './live/useSeatSelection';

/** Kept for existing imports; the constant now lives in utils/seat-math. */
export { SEAT_LOCK_TTL_MS };
export type { SeatFilter } from './live/useSeatSelection';
export type { SeatStateName };
export interface SeatSave { state: SeatStateName; round: { current: number; total: number } | null; votes: Record<string, number> }

/** CONTROLLER: Live Console — composes seats (+ live stream), seat locks, holds and the selection; owns saving a seat. */
export function useLiveConsole(opts?: { holdSelection?: boolean }) {
  const { electionId, election, error: electionsError } = useElection();
  const toastRef = useRef(useToast());
  const { holds, loadHolds, releaseHold } = useHolds(electionId);
  const { locks, loadLocks, applyLockEvent } = useSeatLocks(electionId);
  const { all, loading, load, flashIds } = useLiveSeats(electionId, {
    seatLock: applyLockEvent,
    reconnect: () => { void loadLocks(); void loadHolds(); },
  });
  const selection = useSeatSelection(all, !!opts?.holdSelection, electionId);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Record<string, string>>({});

  const counts = useMemo(() => countSeats(all), [all]);

  const saveSeat = useCallback(async (constId: string, payload: SeatSave) => {
    setSaving(true);
    try {
      await correctSeat(electionId, constId, payload);
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

  return {
    electionId, electionName: election?.name ?? '', electionsError, loading, saving,
    seats: selection.seats, counts, filter: selection.filter, setFilter: selection.setFilter, search: selection.search, setSearch: selection.setSearch,
    selectedId: selection.selectedId, selected: all.find((s) => s.const_id === selection.selectedId) ?? null, select: selection.select, move: selection.move,
    locks, flashIds, reportingPct: reportingPercent(counts), saveSeat, lastSavedAt, holds, releaseHold,
  };
}
