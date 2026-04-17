import { apiFetch, type PaginatedResponse } from './api-client';
import type { Person, PersonWithStats, PersonWithCandidates } from '../types';

/**
 * MODEL: Person API (MVC: Model)
 * Standardized interface for backend PersonsService.
 */

export function getPersons(page = 1, limit = 50, q?: string, stateId?: number, regionId?: number) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set('q', q);
  if (stateId) params.set('state_id', String(stateId));
  if (regionId) params.set('region_id', String(regionId));
  return apiFetch<PaginatedResponse<PersonWithStats>>(`/admin/persons?${params.toString()}`);
}

export function getPerson(id: string) {
  return apiFetch<PersonWithCandidates>(`/admin/persons/${id}`);
}

export function createPerson(name: string, bio?: { photo_url?: string; gender?: string; education?: string; date_of_birth?: string }) {
  return apiFetch<Person>('/admin/persons', {
    method: 'POST',
    body: JSON.stringify({ name, ...bio }),
  });
}

export function updatePerson(id: string, data: Partial<Person>) {
  return apiFetch<Person>(`/admin/persons/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function mergePersons(sourceId: string, targetId: string) {
  return apiFetch<{ merged: boolean; target_id: string }>('/admin/persons/merge', {
    method: 'POST',
    body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
  });
}

export function autoLinkCandidates() {
  return apiFetch<{ persons_created: number; candidates_linked: number }>('/admin/persons/auto-link', { method: 'POST' });
}
