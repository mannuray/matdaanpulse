import { apiFetch } from './api-client';
import type { Election } from '../types';

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

export function createElection(data: { name: string; type: string; year: number; state_id?: number; tentative_next_date?: string; delimitation?: string }) {
  return apiFetch<Election>('/admin/elections', { method: 'POST', body: JSON.stringify(data) });
}

export function updateElection(id: string, data: Partial<Election>) {
  return apiFetch<Election>(`/admin/elections/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function finalizeElection(id: string) {
  return apiFetch<Election>(`/admin/elections/${id}/finalize`, { method: 'POST' });
}
