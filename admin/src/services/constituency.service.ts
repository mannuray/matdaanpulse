import { apiFetch, type PaginatedResponse } from './api-client';
import type { Constituency } from '../types';

export async function getConstituencies(electionId: string) {
  return (await apiFetch<Constituency[]>(`/constituencies?election_id=${electionId}`)) || [];
}

export function getAdminConstituencies(electionId: string, page = 1, limit = 100, q?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set('q', q);
  return apiFetch<PaginatedResponse<Constituency>>(`/admin/constituencies/list/${electionId}?${params.toString()}`);
}

export function getAdminConstituencyDetail(id: string) {
  return apiFetch<Constituency>(`/admin/constituencies/detail/${id}`);
}

export function updateConstituency(id: string, patch: { district_id?: number | null; region_id?: number | null; const_no?: number; metadata?: Record<string, any> }) {
  return apiFetch<Constituency>(`/admin/constituencies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function updateConstituencyMetadata(id: string, metadata: Record<string, unknown>) {
  return apiFetch<Constituency>(`/admin/constituencies/${id}/metadata`, {
    method: 'PATCH',
    body: JSON.stringify(metadata),
  });
}

export async function bulkTagConstituencies(ids: string[], addTags?: string[], removeTags?: string[]) {
  return (await apiFetch<Constituency[]>('/admin/constituencies/bulk-tag', {
    method: 'POST',
    body: JSON.stringify({ ids, add_tags: addTags, remove_tags: removeTags }),
  })) || [];
}
