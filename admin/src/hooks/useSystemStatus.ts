import { useCallback, useEffect, useRef, useState } from 'react';
import { getSystemStatus, type SystemStatus } from '../services/status.service';

export const STATUS_REFRESH_MS = 10_000;

/** Loads system status, then every 10 s while the tab is visible (paused when hidden). */
export function useSystemStatus(fetcher: () => Promise<SystemStatus> = getSystemStatus, intervalMs = STATUS_REFRESH_MS) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetcherRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (timer === undefined) timer = setInterval(() => void refresh(), intervalMs);
    };
    const stop = () => {
      if (timer !== undefined) { clearInterval(timer); timer = undefined; }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else { void refresh(); start(); }
    };
    void refresh();
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [refresh, intervalMs]);

  return { status, error, loading, refresh };
}
