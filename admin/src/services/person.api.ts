import { apiFetch, type PaginatedResponse } from './api-client';
import type { Person, PersonWithStats, PersonWithCandidates } from '../types';

/**
 * MODEL: Person API (MVC: Model)
 * Standardized interface for backend PersonsService.
 */

/** Persons list filter by number of contests: exactly one, or two or more. */
export type ContestsFilter = '0' | '1' | '2plus';

export function getPersons(page = 1, limit = 50, q?: string, filters: { stateId?: number; regionId?: number; contests?: ContestsFilter } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set('q', q);
  if (filters.stateId) params.set('state_id', String(filters.stateId));
  if (filters.regionId) params.set('region_id', String(filters.regionId));
  if (filters.contests) params.set('contests', filters.contests);
  return apiFetch<PaginatedResponse<PersonWithStats>>(`/admin/persons?${params.toString()}`);
}

export function getPerson(id: string) {
  return apiFetch<PersonWithCandidates>(`/admin/persons/${id}`);
}

/** The fields PUT /admin/persons/:id accepts (the backend refuses any other key, e.g. metadata). */
export type PersonUpdate = Partial<Pick<Person, 'name' | 'photo_url' | 'gender' | 'education' | 'date_of_birth' | 'bio' | 'wikipedia_url' | 'caste' | 'religion'>>;

export function updatePerson(id: string, data: PersonUpdate) {
  return apiFetch<Person>(`/admin/persons/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function mergePersons(sourceId: string, targetId: string) {
  return apiFetch<{ merged: boolean; target_id: string; merge_id: string }>('/admin/persons/merge', {
    method: 'POST',
    body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
  });
}

/** Undo a merge (SUPER_ADMIN): recreates the duplicate (`person_id`) and moves its contests back from the keeper. */
export function undoMerge(mergeId: string) {
  return apiFetch<{ undone: boolean; merge_id: string; person_id: string; keeper_id: string }>(`/admin/persons/merges/${mergeId}/undo`, { method: 'POST' });
}

/** Persons by name (manifest picker: leaders with no seat in the election). */
export async function searchPersons(q: string): Promise<{ id: string; name: string }[]> {
  return (await apiFetch<{ id: string; name: string }[]>(`/admin/persons/search?q=${encodeURIComponent(q)}`)) || [];
}
