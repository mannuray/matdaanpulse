import { apiFetch, API_BASE_URL } from './api-client';
import { getToken } from './auth.service';
import type { EnrichmentProgress, ConstituencyAnalysis } from '../types';

// AI Enrichment
export function enrichConstituencies(electionId: string, constIds?: string[], mode?: 'pre_poll' | 'post_poll') {
  return apiFetch<{ total: number; message: string }>(`/admin/constituencies/enrich/${electionId}`, {
    method: 'POST',
    body: JSON.stringify({ const_ids: constIds, mode }),
  });
}

export function enrichCandidates(electionId: string) {
  return apiFetch<{ total: number; message: string }>(`/admin/candidates/enrich/${electionId}`, {
    method: 'POST',
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

// SSE for AI enrichment progress (admin, separate channel)
export function subscribeEnrichmentStream(electionId: string, callback: (event: MessageEvent) => void): EventSource {
  const token = getToken();
  const es = new EventSource(`${API_BASE_URL}/admin/constituencies/enrich/stream/${electionId}?token=${token}`);
  es.onmessage = callback;
  return es;
}
