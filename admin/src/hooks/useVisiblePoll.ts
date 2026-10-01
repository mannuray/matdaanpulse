import { useEffect, useRef } from 'react';

/**
 * Calls `tick` every `ms` while the tab is visible. Paused while hidden; ticks once when the tab comes back.
 * Does not tick on mount (the caller does its first load itself). The latest `tick` is always used.
 */
export function useVisiblePoll(tick: () => void, ms: number, enabled = true): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!enabled) return undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (timer === undefined) timer = setInterval(() => tickRef.current(), ms); };
    const stop = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
    const onVisibility = () => {
      if (document.hidden) stop();
      else { tickRef.current(); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ms, enabled]);
}
