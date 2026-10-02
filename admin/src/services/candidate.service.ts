import { apiFetch } from './api-client';
import type { Candidate, CandidateResult } from '../types';

/**
 * MODEL: Candidate API (MVC: Model)
 * Standardized interface for backend CandidatesService.
 */

/** The admin list: unlike the public `/candidates`, it carries `person_id` and the affidavit (age, assets, liabilities, criminal cases). */
export async function getCandidates(electionId?: string, constId?: string) {
  const params = new URLSearchParams();
  if (electionId) params.set('election_id', electionId);
  if (constId) params.set('const_id', constId);
  const qs = params.toString();
  return (await apiFetch<Candidate[]>(`/admin/candidates${qs ? `?${qs}` : ''}`)) || [];
}

export function getCandidate(id: string) {
  return apiFetch<Candidate>(`/admin/candidates/${id}`);
}

export async function searchCandidates(q: string, electionId?: string) {
  const params = new URLSearchParams({ q });
  if (electionId) params.set('election_id', electionId);
  return (await apiFetch<Candidate[]>(`/candidates/search?${params.toString()}`)) || [];
}

/** Change person: move this candidacy to another existing person (its old person is deleted if left with no contests). */
export function changeCandidatePerson(candidateId: string, personId: string) {
  return apiFetch<Candidate>(`/admin/candidates/${candidateId}/person`, {
    method: 'PUT',
    body: JSON.stringify({ person_id: personId }),
  });
}

/** Split: move this candidacy to a new person created from it (409 when it is the person's only contest). */
export function splitCandidate(candidateId: string) {
  return apiFetch<{ person_id: string; old_person_deleted: boolean }>(`/admin/candidates/${candidateId}/split`, { method: 'POST' });
}

/** The affidavit and candidacy fields PUT/POST /admin/candidates accept (the backend refuses any other key). */
export type CandidateAffidavit = Pick<Candidate, 'age' | 'assets' | 'liabilities' | 'criminal_cases'>;
export type CandidateUpdate = Partial<Pick<Candidate, 'name' | 'party_id' | 'is_incumbent'> & CandidateAffidavit>;

export function createCandidate(data: CandidateUpdate & { election_id: string; const_id: string; name: string }) {
  return apiFetch<Candidate>('/admin/candidates', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCandidate(id: string, data: CandidateUpdate) {
  return apiFetch<Candidate>(`/admin/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function getCandidateResult(id: string) {
  return apiFetch<CandidateResult>(`/admin/candidates/${id}/result`);
}
