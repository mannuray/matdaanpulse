import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { getLiveResults, getSeatLocks } from '../services/live.service';
import { getAuditLogs } from '../services/audit.service';
import { getSystemStatus } from '../services/status.service';
import { getReadiness } from '../services/health.service';
import { getFeedback } from '../services/feedback.service';
import { ApiError } from '../services/api-client';
import { describeError } from '../utils/api-error';
import { editingNow, healthFromReadiness, healthFromStatus, seatLookup, summarizeLive, type HealthSummary } from '../utils/dashboard';
import { useVisiblePoll } from './useVisiblePoll';
import type { AuditLog, Feedback, LiveConstituency, SeatLock } from '../types';

export const DASHBOARD_REFRESH_MS = 30_000;
export const RECENT_ACTIVITY = 10;
export const FEEDBACK_PREVIEWS = 3;

export interface CardState<T> { data: T | null; loading: boolean; error: string | null; reload: () => Promise<void> }
export interface SeatLocksData { available: boolean; locks: SeatLock[] }
export interface FeedbackPreview { count: number; items: Feedback[] }

/**
 * One dashboard card's data. `loader` null means this role cannot see the card, so nothing is requested.
 * A change of `key` (election, role) starts over; a failed refresh keeps the earlier data. Only the latest
 * request's answer is applied.
 */
function useCard<T>(loader: (() => Promise<T>) | null, key: string, fallback: string): CardState<T> {
  const [state, setState] = useState<Omit<CardState<T>, 'reload'>>({ data: null, loading: !!loader, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const run = loaderRef.current;
    if (!run) return;
    const request = ++latest.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await run();
      if (request === latest.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (request === latest.current) setState((s) => ({ data: s.data, loading: false, error: describeError(err, fallback) }));
    }
  }, [fallback]);

  useEffect(() => {
    latest.current++;
    setState({ data: null, loading: !!loaderRef.current, error: null });
    void reload();
  }, [key, reload]);

  return { ...state, reload };
}

/**
 * CONTROLLER: Dashboard. Cards are gated by role (spec §2, decisions §3):
 * SUPER_ADMIN everything; EDITOR without Recent activity and with the public readiness check;
 * VIEWER none of these (the page shows the elections overview from ElectionContext).
 */
export function useDashboard() {
  const { hasRole } = useAuth();
  const { electionId, election, elections, loading: electionsLoading, error: electionsError, reload: reloadElections } = useElection();
  const isSuper = hasRole('SUPER_ADMIN');
  const canEdit = hasRole('SUPER_ADMIN', 'EDITOR');
  const liveId = canEdit ? electionId : '';

  const live = useCard<LiveConstituency[]>(liveId ? () => getLiveResults(liveId) : null, `live:${liveId}`, 'Could not load live results');
  const locks = useCard<SeatLocksData>(
    liveId
      ? async () => {
        try {
          return { available: true, locks: await getSeatLocks(liveId) };
        } catch (err) {
          // Redis down: locking is off (the Live Console warns too); not a card error.
          if (err instanceof ApiError && err.status === 503) return { available: false, locks: [] };
          throw err;
        }
      }
      : null,
    `locks:${liveId}`,
    'Could not load seat locks',
  );
  const activity = useCard<AuditLog[]>(
    isSuper ? async () => (await getAuditLogs()).slice(0, RECENT_ACTIVITY) : null,
    `activity:${isSuper}`,
    'Could not load recent activity',
  );
  const health = useCard<HealthSummary>(
    isSuper
      ? async () => healthFromStatus(await getSystemStatus())
      : canEdit ? async () => healthFromReadiness(await getReadiness()) : null,
    `health:${isSuper}:${canEdit}`,
    'Could not load system health',
  );
  const feedback = useCard<FeedbackPreview>(
    canEdit
      ? async () => {
        const res = await getFeedback(1, FEEDBACK_PREVIEWS, 'new');
        const items = res.data ?? [];
        return { count: res.pagination?.total ?? items.length, items };
      }
      : null,
    `feedback:${canEdit}`,
    'Could not load feedback',
  );

  const [now, setNow] = useState(() => Date.now());
  const reloadLive = live.reload;
  const reloadLocks = locks.reload;
  const reloadActivity = activity.reload;
  const reloadHealth = health.reload;
  const reloadFeedback = feedback.reload;
  const refreshAll = useCallback(() => {
    setNow(Date.now());
    void reloadElections();
    void reloadLive();
    void reloadLocks();
    void reloadActivity();
    void reloadHealth();
    void reloadFeedback();
  }, [reloadElections, reloadLive, reloadLocks, reloadActivity, reloadHealth, reloadFeedback]);
  useVisiblePoll(refreshAll, DASHBOARD_REFRESH_MS);

  const summary = useMemo(() => (live.data ? summarizeLive(live.data) : null), [live.data]);
  const editing = useMemo(
    () => (live.data && locks.data ? editingNow(locks.data.locks, live.data, now) : []),
    [live.data, locks.data, now],
  );
  const lookup = useMemo(() => seatLookup(live.data ?? []), [live.data]);

  return {
    isSuper, canEdit, electionId, election, elections, electionsLoading, electionsError, reloadElections, now,
    live, summary, locks, editing, activity, lookup, health, feedback, refreshAll,
  };
}
