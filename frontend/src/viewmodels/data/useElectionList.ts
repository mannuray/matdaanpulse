import { useCallback, useRef } from 'react';
import { useApi } from './useApi';
import { getElections } from '../../model/api/election.service';
import type { Election } from '../../model/types';

/**
 * The unfiltered `/elections` list, shared by every caller of a page load: the landing page (default election), the
 * dashboard's top bar and the constituency page. useApi's dedupe key only merges requests in flight at the same time,
 * while the landing page and the dashboard fetch one after the other, so the answer is kept for a short while.
 * A failure is never kept (the top bar retries it).
 */
export const ELECTION_LIST_TTL_MS = 60_000;

let cached: { at: number; promise: Promise<Election[]> } | null = null;

/** The cached list, or a new request when there is none, it is older than the TTL, or `force`. */
export function loadElectionList(force = false): Promise<Election[]> {
  const now = Date.now();
  if (!force && cached && now - cached.at < ELECTION_LIST_TTL_MS) return cached.promise;
  const promise = getElections();
  const entry = { at: now, promise };
  cached = entry;
  promise.catch(() => { if (cached === entry) cached = null; });
  return promise;
}

/** Drops the cached list (tests). */
export function forgetElectionList(): void {
  cached = null;
}

export function useElectionList() {
  const force = useRef(false);
  const res = useApi(() => {
    const f = force.current;
    force.current = false;
    return loadElectionList(f);
  }, [], { key: 'elections_all' });
  const { refetch: refetchApi } = res;
  const refetch = useCallback(() => { force.current = true; refetchApi(); }, [refetchApi]);
  return { ...res, refetch };
}
