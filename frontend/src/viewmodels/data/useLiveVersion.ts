import { useEffect, useState } from 'react';
import { getLiveState } from '../../model/api/election.service';
import { LivePoller, type LiveElectionStatus } from '../../model/live/poller';
import { documentVisibility } from './documentVisibility';

export interface LiveVersion {
  /** Latest results version from /live (null before counting or before the first poll). */
  version: number | null;
  /** Latest election status from /live (null until the first poll). */
  status: LiveElectionStatus | null;
}

const NONE: LiveVersion = { version: null, status: null };

/**
 * Only the small, CDN-cached `/elections/:id/live` document, for a page that fetches its own per-version data
 * (the constituency page: `/constituencies/:id?v=<version>`) instead of the full results snapshot. Same cadence,
 * backoff, visibility pause and forward-only versions as the dashboard (model/live/poller); no snapshot is loaded.
 */
export function useLiveVersion(electionId: string | undefined, enabled: boolean): LiveVersion {
  const [state, setState] = useState<LiveVersion & { electionId: string | null }>({ ...NONE, electionId: null });

  useEffect(() => {
    if (!electionId || !enabled) return;
    const poller = new LivePoller<{ version: number }>({
      fetchLive: () => getLiveState(electionId),
      // No snapshot: the version itself is all this page needs.
      fetchSnapshot: (version) => Promise.resolve({ version }),
      onSnapshot: ({ version }) => setState(s => ({ electionId, status: s.electionId === electionId ? s.status : null, version })),
      onLive: (live) => setState(s => {
        const cur = s.electionId === electionId ? s : { ...NONE, electionId };
        return cur.status === live.status && cur === s ? s : { ...cur, status: live.status };
      }),
      visibility: documentVisibility,
    });
    poller.start();
    return () => {
      poller.stop();
      setState({ ...NONE, electionId: null });
    };
  }, [electionId, enabled]);

  return enabled && state.electionId === electionId ? { version: state.version, status: state.status } : NONE;
}
