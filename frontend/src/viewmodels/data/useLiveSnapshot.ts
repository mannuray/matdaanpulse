import { useEffect, useState } from 'react';
import { getLiveState, getResultsSnapshot } from '../../model/api/election.service';
import { LivePoller, type Visibility } from '../../model/live/poller';
import type { ResultsSnapshot } from '../../model/types';

const documentVisibility: Visibility = {
  isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  subscribe: (onChange) => {
    if (typeof document === 'undefined') return () => undefined;
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  },
};

interface State {
  electionId: string | null;
  snapshot: ResultsSnapshot | null;
  connected: boolean;
}

/**
 * Live results for viewers: polls /live (CDN-cached) and loads the versioned
 * snapshot on every version change (model/live/poller). Disabled → nothing is
 * fetched and `snapshot` is null.
 */
export function useLiveSnapshot(electionId: string | undefined, enabled: boolean) {
  const [state, setState] = useState<State>({ electionId: null, snapshot: null, connected: false });

  useEffect(() => {
    if (!electionId || !enabled) return;
    const poller = new LivePoller<ResultsSnapshot>({
      fetchLive: () => getLiveState(electionId),
      fetchSnapshot: (version) => getResultsSnapshot(electionId, version),
      onSnapshot: (snapshot) => setState(s => ({ electionId, snapshot, connected: s.electionId === electionId ? s.connected : true })),
      onStatus: (ok) => setState(s => (s.electionId === electionId
        ? (s.connected === ok ? s : { ...s, connected: ok })
        : { electionId, snapshot: null, connected: ok })),
      visibility: documentVisibility,
    });
    poller.start();
    return () => {
      poller.stop();
      setState({ electionId: null, snapshot: null, connected: false });
    };
  }, [electionId, enabled]);

  const current = enabled && state.electionId === electionId;
  return { snapshot: current ? state.snapshot : null, connected: current && state.connected };
}
