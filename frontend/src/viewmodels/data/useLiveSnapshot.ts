import { useCallback, useEffect, useRef, useState } from 'react';
import { getLiveState, getResultsSnapshot } from '../../model/api/election.service';
import { describeApiError } from '../../model/api/api-client';
import { LivePoller, type LiveElectionStatus } from '../../model/live/poller';
import { documentVisibility } from './documentVisibility';
import type { ResultsSnapshot } from '../../model/types';

/** Consecutive failures before a dashboard that has no snapshot yet shows an error (with Retry). */
export const LIVE_FAILURES_BEFORE_ERROR = 3;

interface State {
  electionId: string | null;
  snapshot: ResultsSnapshot | null;
  connected: boolean;
  status: LiveElectionStatus | null;
  failures: number;
  error: string | null;
}

const EMPTY: State = { electionId: null, snapshot: null, connected: false, status: null, failures: 0, error: null };

export interface LiveSnapshotResult {
  snapshot: ResultsSnapshot | null;
  connected: boolean;
  /** Latest election status reported by /live (null until the first poll). */
  status: LiveElectionStatus | null;
  /** Set after repeated failures while there is no snapshot yet. */
  error: string | null;
  /** Poll now (Retry). */
  pollNow: () => void;
}

/**
 * Live results for viewers: polls /live (CDN-cached) and loads the versioned
 * snapshot on every newer version (model/live/poller). Disabled → nothing is
 * fetched and `snapshot` is null.
 */
export function useLiveSnapshot(electionId: string | undefined, enabled: boolean): LiveSnapshotResult {
  const [state, setState] = useState<State>(EMPTY);
  const pollerRef = useRef<LivePoller<ResultsSnapshot> | null>(null);
  /** Failures before the error shows: 3 at first, 1 after a manual Retry. */
  const thresholdRef = useRef(LIVE_FAILURES_BEFORE_ERROR);

  useEffect(() => {
    if (!electionId || !enabled) return;
    thresholdRef.current = LIVE_FAILURES_BEFORE_ERROR;
    const mine = (s: State): State => (s.electionId === electionId ? s : { ...EMPTY, electionId });
    const poller = new LivePoller<ResultsSnapshot>({
      fetchLive: () => getLiveState(electionId),
      fetchSnapshot: (version) => getResultsSnapshot(electionId, version),
      onSnapshot: (snapshot) => setState(s => ({ ...mine(s), snapshot, error: null })),
      onLive: (live) => setState(s => (mine(s).status === live.status && s.electionId === electionId ? s : { ...mine(s), status: live.status })),
      onStatus: (ok, failures, err) => setState(s => {
        const cur = mine(s);
        const error = !ok && !cur.snapshot && failures >= thresholdRef.current ? describeApiError(err) : ok ? null : cur.error;
        if (cur === s && cur.connected === ok && cur.failures === failures && cur.error === error) return s;
        return { ...cur, connected: ok, failures, error };
      }),
      visibility: documentVisibility,
    });
    pollerRef.current = poller;
    poller.start();
    return () => {
      poller.stop();
      if (pollerRef.current === poller) pollerRef.current = null;
      setState(EMPTY);
    };
  }, [electionId, enabled]);

  const pollNow = useCallback(() => {
    thresholdRef.current = 1;
    setState(s => (s.error ? { ...s, error: null, failures: 0 } : s));
    pollerRef.current?.pollNow();
  }, []);

  const current = enabled && state.electionId === electionId;
  return {
    snapshot: current ? state.snapshot : null,
    connected: current && state.connected,
    status: current ? state.status : null,
    error: current ? state.error : null,
    pollNow,
  };
}
