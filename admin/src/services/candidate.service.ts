import { apiFetch } from './api-client';
import type { Candidate, CandidateResult } from '../types';

/**
 * MODEL: Candidate API (MVC: Model)
 * Standardized interface for backend CandidatesService.
 */

export async function getCandidates(electionId?: string, constId?: string) {
  const params = new URLSearchParams();
  if (electionId) params.set('election_id', electionId);
  if (constId) params.set('const_id', constId);
  const qs = params.toString();
  return (await apiFetch<Candidate[]>(`/candidates${qs ? `?${qs}` : ''}`)) || [];
}

export function getCandidate(id: string) {
  return apiFetch<Candidate>(`/admin/candidates/${id}`);
}

export async function searchCandidates(q: string, electionId?: string) {
  const params = new URLSearchParams({ q });
  if (electionId) params.set('election_id', electionId);
  return (await apiFetch<Candidate[]>(`/candidates/search?${params.toString()}`)) || [];
}

export function linkCandidatePerson(candidateId: string, personId: string) {
  return apiFetch<Candidate>(`/admin/candidates/${candidateId}/link-person`, {
    method: 'PUT',
    body: JSON.stringify({ person_id: personId }),
  });
}

export function unlinkCandidatePerson(candidateId: string) {
  return apiFetch<Candidate>(`/admin/candidates/${candidateId}/link-person`, {
    method: 'DELETE',
  });
}

export function createCandidate(data: Partial<Candidate>) {
  return apiFetch<Candidate>('/admin/candidates', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCandidate(id: string, data: Partial<Candidate>) {
  return apiFetch<Candidate>(`/admin/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function getCandidateResult(id: string) {
  return apiFetch<CandidateResult>(`/admin/candidates/${id}/result`);
}
