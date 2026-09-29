import { apiFetch, API_BASE_URL } from './api-client';
import { getToken, handleUnauthorized } from './auth.service';
import { SseParser } from '../utils/sse';
import type { EnrichmentProgress, ConstituencyAnalysis } from '../types';

// AI Enrichment
export function enrichConstituencies(electionId: string, constIds?: string[], mode?: 'pre_poll' | 'post_poll') {
  return apiFetch<{ total: number; message: string }>(`/admin/constituencies/enrich/${electionId}`, {
    method: 'POST',
    body: JSON.stringify({ const_ids: constIds, mode }),
  });
}

export function enrichCandidates(electionId: string, candidateIds?: string[]) {
  return apiFetch<{ total: number; message: string }>(`/admin/candidates/enrich/${electionId}`, {
    method: 'POST',
    body: JSON.stringify(candidateIds?.length ? { candidate_ids: candidateIds } : {}),
  });
}

export function enrichPersons(personIds?: string[]) {
  return apiFetch<{ total: number; message: string }>('/admin/persons/enrich', {
    method: 'POST',
    body: JSON.stringify(personIds ? { person_ids: personIds } : {}),
  });
}

export function getPersonEnrichmentStatus() {
  return apiFetch<EnrichmentProgress>('/admin/persons/enrich/status');
}

export function getEnrichmentStatus(electionId: string) {
  return apiFetch<EnrichmentProgress>(`/admin/constituencies/enrich/status/${electionId}`);
}

// Constituency Analysis
export async function getConstituencyAnalysis(electionId: string) {
  return (await apiFetch<ConstituencyAnalysis[]>(`/admin/constituencies/analysis/${electionId}`)) || [];
}

export function computeConstituencyAnalysis(electionId: string, historyElectionIds: string[], manifest?: Record<string, unknown>) {
  return apiFetch<{ computed: number }>(`/admin/constituencies/analysis/compute/${electionId}`, {
    method: 'POST',
    body: JSON.stringify({ history_election_ids: historyElectionIds, manifest }),
  });
}

export function updateConstituencyAnalysis(id: string, data: Partial<ConstituencyAnalysis>) {
  return apiFetch<ConstituencyAnalysis>(`/admin/constituencies/analysis/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function bulkUpdateAiStatus(ids: string[], status: string) {
  return apiFetch<{ updated: number }>('/admin/constituencies/analysis/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ ids, status }),
  });
}

// SSE for AI enrichment progress (admin, separate channel).
// EventSource cannot send an Authorization header, so the stream is read via fetch().
const STREAM_RETRY_BASE_MS = 1000;
const STREAM_RETRY_MAX_MS = 30000;

export function subscribeEnrichmentStream(
  electionId: string,
  onProgress: (progress: EnrichmentProgress) => void,
): () => void {
  const controller = new AbortController();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let stopped = false;

  const stop = () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    controller.abort();
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    const delay = Math.min(STREAM_RETRY_BASE_MS * 2 ** attempt, STREAM_RETRY_MAX_MS);
    attempt++;
    retryTimer = setTimeout(connect, delay);
  };

  async function connect() {
    retryTimer = null;
    if (stopped) return;
    const token = getToken();
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/constituencies/enrich/stream/${encodeURIComponent(electionId)}`,
        { headers, signal: controller.signal },
      );
      if (response.status === 401) {
        stop();
        handleUnauthorized();
        return;
      }
      if (!response.ok || !response.body) {
        // 403/404 etc. will not fix themselves on retry
        if (response.status >= 400 && response.status < 500) stop();
        else scheduleReconnect();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
          attempt = 0; // healthy stream: reset backoff once data actually flows
          if (frame.event !== 'enrichment-progress') continue; // ignore ping etc.
          try {
            onProgress(JSON.parse(frame.data) as EnrichmentProgress);
          } catch {
            /* malformed frame */
          }
        }
      }
      scheduleReconnect(); // server closed the stream
    } catch {
      if (!stopped) scheduleReconnect(); // network drop; AbortError when stopped
    }
  }

  connect();
  return stop;
}
