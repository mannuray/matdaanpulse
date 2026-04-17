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

export function subscribeLiveUpdates(electionId: string, callback: (event: MessageEvent) => void): EventSource {
  const es = new EventSource(`${API_BASE_URL}/live/updates?election_id=${electionId}`);
  es.onmessage = callback;
  return es;
}
