import { apiFetch, type PaginatedResponse } from './api-client';
import type { Party, PartyUsage, EciRecognition } from '../types';

export async function getParties() {
  return (await apiFetch<Party[]>('/parties')) || [];
}

export function getParty(id: string) {
  return apiFetch<Party>(`/admin/parties/${id}`);
}

/** `eciRecognition`: a recognition value, or 'none' for parties with none set. */
export function getPartiesPaginated(page = 1, limit = 25, q?: string, electionId?: string, stateId?: number, eciRecognition?: EciRecognition | 'none') {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set('q', q);
  if (electionId) params.set('election_id', electionId);
  if (stateId) params.set('state_id', String(stateId));
  if (eciRecognition) params.set('eci_recognition', eciRecognition);
  return apiFetch<PaginatedResponse<Party & { candidate_count?: number }>>(`/parties?${params.toString()}`);
}

export function getPartyUsage(id: string) {
  return apiFetch<PartyUsage>(`/admin/parties/${id}/usage`);
}

export function createParty(data: { id: string; name: string; color?: string; symbol_url?: string; abbreviation?: string; leader_name?: string; founded_year?: number; headquarters?: string; website?: string }) {
  return apiFetch<Party>('/admin/parties', { method: 'POST', body: JSON.stringify(data) });
}

export function updateParty(id: string, data: Partial<Party>) {
  return apiFetch<Party>(`/admin/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
