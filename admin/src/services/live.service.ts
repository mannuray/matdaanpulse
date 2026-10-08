import { apiFetch, API_BASE_URL } from './api-client';
import type { LiveConstituency, SeatLock } from '../types';

export async function getLiveResults(electionId: string) {
  return (await apiFetch<LiveConstituency[]>(`/admin/elections/${electionId}/live-results`)) || [];
}

export async function getSeatLocks(electionId: string) {
  return (await apiFetch<SeatLock[]>(`/admin/live/locks?election_id=${encodeURIComponent(electionId)}`)) || [];
}

export function acquireSeatLock(electionId: string, constId: string, takeOver = false) {
  return apiFetch<SeatLock>('/admin/live/locks', {
    method: 'POST',
    body: JSON.stringify({ election_id: electionId, const_id: constId, ...(takeOver ? { take_over: true } : {}) }),
  });
}

/** keepalive lets the release survive the tab closing (sendBeacon cannot send the auth header). */
export async function releaseSeatLock(electionId: string, constId: string, opts?: { keepalive?: boolean }) {
  await apiFetch<void>('/admin/live/locks/release', {
    method: 'POST',
    keepalive: opts?.keepalive,
    body: JSON.stringify({ election_id: electionId, const_id: constId }),
  });
}

/** Compact live result payload broadcast on the admin live SSE channel. */
export interface LiveResultUpdate {
  const_id: string;
  p?: unknown;
  m?: unknown;
  s?: unknown;
  r?: unknown;
  cr?: number;
  tr?: number;
}

export interface LiveUpdateHandlers {
  onResultUpdate: (update: LiveResultUpdate) => void;
  onBatchUpdate: (updates: LiveResultUpdate[]) => void;
  /** A reconnect after a drop: events may have been missed, reload the data. */
  onReconnect?: () => void;
  /** Another editor took, refreshed or released a seat lock. */
  onSeatLock?: (event: { const_id: string; lock: SeatLock | null }) => void;
  /** Stream state for the top-bar pill: 'offline' after SSE_OFFLINE_AFTER failed attempts in a row. */
  onStatus?: (status: 'connecting' | 'open' | 'reconnecting' | 'offline') => void;
}

/** 5-minute, single-election token for the admin SSE stream (EventSource cannot send Authorization). */
export function getLiveSseToken(electionId: string) {
  return apiFetch<{ token: string; expiresInSeconds: number }>('/admin/live/sse-token', {
    method: 'POST',
    body: JSON.stringify({ election_id: electionId }),
  });
}

/** After this many failed (re)connects in a row the pill says "offline" (the stream keeps retrying). */
export const SSE_OFFLINE_AFTER = 3;

/** Delay before reconnect attempt `n` (0-based): 1 s, 2 s, 4 s … capped at 30 s, plus up to 1 s jitter. */
export function sseRetryDelay(attempt: number, random: () => number = Math.random): number {
  return Math.min(30_000, 1000 * 2 ** attempt) + Math.round(random() * 1000);
}

/**
 * Subscribe to the admin live stream of one election. Fetches a fresh SSE token
 * for every (re)connect — the token expires after 5 minutes, and EventSource would
 * otherwise retry forever with an expired one. Returns an unsubscribe function.
 * Backend emits NAMED events ('result-update', 'batch-update', 'ping'), which
 * es.onmessage never receives — listeners are registered per event name.
 */
export function subscribeLiveUpdates(electionId: string, handlers: LiveUpdateHandlers): () => void {
  let es: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  /** Failed attempts since the last successful open (token request or stream error). */
  let failures = 0;
  let opened = false;
  let closed = false;

  const retry = () => {
    if (closed) return;
    timer = setTimeout(connect, sseRetryDelay(attempt++));
  };

  const fail = () => {
    if (closed) return;
    failures += 1;
    handlers.onStatus?.(failures >= SSE_OFFLINE_AFTER ? 'offline' : 'reconnecting');
    retry();
  };

  async function connect() {
    if (closed) return;
    // Only the very first attempt says "connecting"; retries keep "reconnecting" / "offline" on the pill.
    if (!opened && failures === 0) handlers.onStatus?.('connecting');
    let token: string;
    try {
      token = (await getLiveSseToken(electionId)).token;
    } catch {
      return fail();
    }
    if (closed) return;
    const source = new EventSource(
      `${API_BASE_URL}/admin/live/updates?election_id=${encodeURIComponent(electionId)}&token=${encodeURIComponent(token)}`,
    );
    es = source;
    source.onopen = () => {
      if (opened) handlers.onReconnect?.();
      opened = true;
      attempt = 0;
      failures = 0;
      handlers.onStatus?.('open');
    };
    source.onerror = () => {
      source.close();
      if (es === source) es = null;
      fail();
    };
    source.addEventListener('result-update', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data?.const_id) handlers.onResultUpdate(data);
      } catch { /* malformed frame */ }
    });
    source.addEventListener('batch-update', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (Array.isArray(data)) handlers.onBatchUpdate(data.filter((u) => u?.const_id));
      } catch { /* malformed frame */ }
    });
    source.addEventListener('seat-lock', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data?.const_id) handlers.onSeatLock?.({ const_id: data.const_id, lock: data.lock ?? null });
      } catch { /* malformed frame */ }
    });
  }

  void connect();
  return () => {
    closed = true;
    clearTimeout(timer);
    es?.close();
    es = null;
  };
}
