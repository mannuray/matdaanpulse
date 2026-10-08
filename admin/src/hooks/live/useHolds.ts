import { useCallback, useEffect, useRef, useState } from 'react';
import { getHolds, releaseHold as releaseHoldRequest } from '../../services/ingest.service';
import { useToast } from '../../context/ToastContext';
import type { HoldRow } from '../../types';

export const HOLDS_POLL_MS = 15_000;

/** Seats on hold (admin corrections): polled on their own interval, refreshed on demand; released one by one. */
export function useHolds(electionId: string) {
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const toastRef = useRef(useToast());
  const electionRef = useRef(electionId);
  electionRef.current = electionId;

  const loadHolds = useCallback(async () => {
    if (!electionId) return;
    try {
      const list = await getHolds(electionId);
      if (electionRef.current === electionId) setHolds(list);
    } catch {
      // keep the last list: a failed refresh must not hide holds that still exist
    }
  }, [electionId]);

  useEffect(() => {
    setHolds([]);
    void loadHolds();
    const t = setInterval(() => { void loadHolds(); }, HOLDS_POLL_MS);
    return () => clearInterval(t);
  }, [loadHolds]);

  const releaseHold = useCallback(async (constId: string) => {
    try {
      await releaseHoldRequest(electionId, constId);
      toastRef.current.toast('Hold released');
    } catch (err) {
      toastRef.current.toastError(err, 'Failed to release hold');
    }
    await loadHolds();
  }, [electionId, loadHolds]);

  return { holds, loadHolds, releaseHold };
}
