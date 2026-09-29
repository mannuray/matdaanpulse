import { apiFetch, API_BASE_URL } from './api-client';
import type { Election, Manifest, LiveConstituency } from '../types';

export async function getElections(filters?: { type?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return (await apiFetch<Election[]>(`/elections${qs ? `?${qs}` : ''}`)) || [];
}

export function getElection(id: string) {
  return apiFetch<Election>(`/elections/${id}`);
}

export function createElection(data: { name: string; type: string; year: number; state_id?: number; tentative_next_date?: string }) {
  return apiFetch<Election>('/admin/elections', { method: 'POST', body: JSON.stringify(data) });
}

export function updateElection(id: string, data: Partial<Election>) {
  return apiFetch<Election>(`/admin/elections/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function finalizeElection(id: string) {
  return apiFetch<Election>(`/admin/elections/${id}/finalize`, { method: 'POST' });
}

export function getManifest(electionId: string) {
  return apiFetch<Manifest>(`/admin/elections/${electionId}/manifest`);
}

export function saveManifestDraft(electionId: string, manifest: object) {
  return apiFetch<Manifest>(`/admin/elections/${electionId}/manifest`, {
    method: 'PUT',
    body: JSON.stringify(manifest),
  });
}

export function publishManifest(electionId: string) {
  return apiFetch<Manifest>(`/admin/elections/${electionId}/manifest/publish`, { method: 'POST' });
}

export async function getLiveResults(electionId: string) {
  return (await apiFetch<LiveConstituency[]>(`/admin/elections/${electionId}/live-results`)) || [];
}

export function overrideResult(data: { result_id: string; votes?: number; status?: string; margin?: number }) {
  return apiFetch<void>('/admin/results/override', { method: 'PATCH', body: JSON.stringify(data) });
}

/** Compact live result payload broadcast on the public SSE channel. */
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
}

// Backend emits NAMED events ('result-update', 'batch-update', 'ping'), which
// es.onmessage never receives — listeners must be registered per event name.
export function subscribeLiveUpdates(electionId: string, handlers: LiveUpdateHandlers): EventSource {
  const es = new EventSource(`${API_BASE_URL}/live/updates?election_id=${encodeURIComponent(electionId)}`);
  es.addEventListener('result-update', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data);
      if (data?.const_id) handlers.onResultUpdate(data);
    } catch { /* malformed frame */ }
  });
  es.addEventListener('batch-update', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data);
      if (Array.isArray(data)) handlers.onBatchUpdate(data.filter((u) => u?.const_id));
    } catch { /* malformed frame */ }
  });
  return es;
}
