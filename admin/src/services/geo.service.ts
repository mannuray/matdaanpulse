import { apiFetch, type PaginatedResponse } from './api-client';
import type { State, Party } from '../types';

export async function getStates() {
  return (await apiFetch<State[]>('/states')) || [];
}

export async function getDistricts(stateId: number) {
  return (await apiFetch<Array<{ id: number; name: string; code: string }>>(`/states/${stateId}/districts`)) || [];
}

export async function getRegions(stateId: number) {
  return (await apiFetch<Array<{ id: number; name: string; code: string }>>(`/states/${stateId}/regions`)) || [];
}

export async function getParties() {
  return (await apiFetch<Party[]>('/parties')) || [];
}

export function getParty(id: string) {
  return apiFetch<Party>(`/admin/parties/${id}`);
}

export function getPartiesPaginated(page = 1, limit = 25, q?: string, electionId?: string, stateId?: number) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set('q', q);
  if (electionId) params.set('election_id', electionId);
  if (stateId) params.set('state_id', String(stateId));
  return apiFetch<PaginatedResponse<Party & { candidate_count?: number }>>(`/parties?${params.toString()}`);
}

export function createParty(data: { id: string; name: string; color?: string; symbol_url?: string; abbreviation?: string; leader_name?: string; founded_year?: number; headquarters?: string; website?: string }) {
  return apiFetch<Party>('/admin/parties', { method: 'POST', body: JSON.stringify(data) });
}

export function updateParty(id: string, data: Partial<Party>) {
  return apiFetch<Party>(`/admin/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function enrichParty(id: string) {
  return apiFetch<Party>(`/admin/parties/${id}/enrich`, { method: 'POST' });
}
