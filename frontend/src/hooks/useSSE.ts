import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../services/api-client';
import type { SSEEvent } from '../types';

const MAX_RETRIES = 8;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

function parseSSEData(e: MessageEvent, tag: string): any | null {
  try { return JSON.parse(e.data); }
  catch { console.warn(`${tag} Failed to parse SSE data`); return null; }
}

export function useSSE(electionId: string | undefined, onEvent: (event: SSEEvent) => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback((id: string, retryCount: number, cleanup: { cancelled: boolean; close?: () => void }) => {
    if (cleanup.cancelled) return;
    const tag = `[SSE ${id.substring(0, 8)}]`;
    const es = new EventSource(`${API_BASE_URL}/live/updates?election_id=${id}`);

    es.onopen = () => { setConnected(true); retryCount = 0; };

    es.addEventListener('result-update', (e) => {
      const data = parseSSEData(e, tag);
      if (data?.const_id) onEventRef.current({ type: 'result-update', data });
    });
    es.addEventListener('tally-update', (e) => {
      const data = parseSSEData(e, tag);
      if (data) onEventRef.current({ type: 'tally-update', data });
    });
    es.addEventListener('batch-update', (e) => {
      const data = parseSSEData(e, tag);
      if (Array.isArray(data)) onEventRef.current({ type: 'batch-update', data });
    });

    es.onerror = () => {
      es.close();
      setConnected(false);
      if (cleanup.cancelled) return;
      if (retryCount >= MAX_RETRIES) return;
      const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount) + Math.random() * 1000, MAX_DELAY_MS);
      setTimeout(() => connect(id, retryCount + 1, cleanup), delay);
    };

    cleanup.close = () => { es.close(); cleanup.cancelled = true; };
  }, []);

  useEffect(() => {
    if (!electionId) return;
    const cleanup: { cancelled: boolean; close?: () => void } = { cancelled: false };
    connect(electionId, 0, cleanup);
    return () => { cleanup.close?.(); setConnected(false); };
  }, [electionId, connect]);

  return { connected };
}
