import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../model/api/api-client';
import type { SSEEvent, SSEResultData } from '../../model/types';

const FAST_RETRIES = 8;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
/** After the fast retries are exhausted, keep trying at this slow interval. */
const SLOW_RETRY_MS = 60000;

function parseSSEData(e: MessageEvent, tag: string): unknown {
  try { return JSON.parse(e.data); }
  catch { console.warn(`${tag} Failed to parse SSE data`); return null; }
}

function isResultRow(v: unknown): v is SSEResultData {
  return !!v && typeof v === 'object' && typeof (v as SSEResultData).const_id === 'string';
}

/** Exported for tests: delay before the given retry attempt (0-based). */
export function retryDelay(attempt: number, jitter = Math.random() * 1000): number {
  if (attempt >= FAST_RETRIES) return SLOW_RETRY_MS;
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt) + jitter, MAX_DELAY_MS);
}

/**
 * Subscribe to live election events (`result-update`, `batch-update`; `ping`
 * heartbeats are ignored). Reconnects with exponential backoff, then falls back
 * to a slow retry; also reconnects immediately when the browser comes back
 * online or the tab becomes visible again.
 */
export function useSSE(electionId: string | undefined, onEvent: (event: SSEEvent) => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!electionId) return;
    const tag = `[SSE ${electionId.substring(0, 8)}]`;
    let cancelled = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      clearTimeout(retryTimer);
      es?.close();
      const source = new EventSource(`${API_BASE_URL}/live/updates?election_id=${electionId}`);
      es = source;

      source.onopen = () => { setConnected(true); attempt = 0; };

      source.addEventListener('result-update', (e) => {
        const data = parseSSEData(e as MessageEvent, tag);
        if (isResultRow(data)) onEventRef.current({ type: 'result-update', data });
      });
      source.addEventListener('batch-update', (e) => {
        const data = parseSSEData(e as MessageEvent, tag);
        if (Array.isArray(data)) onEventRef.current({ type: 'batch-update', data: data.filter(isResultRow) });
      });

      source.onerror = () => {
        source.close();
        if (es === source) es = null;
        setConnected(false);
        if (cancelled) return;
        retryTimer = setTimeout(connect, retryDelay(attempt));
        attempt++;
      };
    };

    // Recover promptly after network loss / backgrounded tab.
    const wake = () => {
      if (cancelled || es) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      attempt = 0;
      connect();
    };
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      es?.close();
      es = null;
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
      setConnected(false);
    };
  }, [electionId]);

  return { connected };
}
