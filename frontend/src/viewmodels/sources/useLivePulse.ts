import { useCallback, useEffect, useRef, useState } from 'react';
import { appendTicker, type TickerEvent } from '../../model/live/ticker';
import { liveStep, type LiveStepState, type PulseKind } from '../../model/live/pulse';
import type { SeatLive } from '../../model/derive/seatAnalysis';
import type { ResultRow } from '../../model/types';

export const RECENT_CHANGE_MS = 3000;

/** The fast-changing live state: seats that just changed (pulse on the map) and the ticker. Kept out of the dashboard sources so a pulse never rebuilds them. */
export interface LivePulse { ticker: TickerEvent[]; recentSeats: Map<string, PulseKind> }

/**
 * Each new live snapshot is diffed against the previous snapshot of the same election: seats whose leader changed feed
 * the ticker and pulse on the map. The first snapshot (and the first after switching elections) is the baseline, not
 * news. Snapshots only move forward (the poller drops older versions), so events are never replayed backwards.
 */
export function useLivePulse(electionId: string, results: ResultRow[], liveVersion: number | null, liveSeats: Map<string, SeatLive> | null | undefined): LivePulse {
  const [ticker, setTicker] = useState<TickerEvent[]>([]);
  const [recentSeats, setRecentSeats] = useState<Map<string, PulseKind>>(() => new Map());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach(clearTimeout); t.clear(); };
  }, []);
  const markRecent = useCallback((kinds: Map<string, PulseKind>) => {
    if (kinds.size === 0) return;
    setRecentSeats(prev => new Map([...prev, ...kinds]));
    for (const id of kinds.keys()) {
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => {
        timers.current.delete(id);
        setRecentSeats(prev => { const n = new Map(prev); n.delete(id); return n; });
      }, RECENT_CHANGE_MS));
    }
  }, []);
  const liveState = useRef<LiveStepState | null>(null);
  useEffect(() => {
    if (liveVersion === null) { liveState.current = null; return; }
    const upsets = new Map([...(liveSeats?.values() ?? [])].filter(s => s.upsets.length).map(s => [s.const_id, s.upsets]));
    const step = liveStep(liveState.current, { electionId, version: liveVersion, results, upsets });
    liveState.current = step.state;
    if (step.kinds.size === 0) return;
    markRecent(step.kinds);
    setTicker(p => appendTicker(p, step.changes, Date.now(), step.ups));
  }, [results, liveVersion, electionId, markRecent, liveSeats]);
  return { ticker, recentSeats };
}
