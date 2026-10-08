import { apiFetch } from './api-client';
import type { ConstituencySearchHit, Candidate } from '../types';

/**
 * Global Search Services (SOLID: SRP)
 */

export function searchConstituencies(q: string, election_id?: string, district_id?: number) {
  const params = new URLSearchParams({ q });
  if (election_id) params.set('election_id', election_id);
  if (district_id) params.set('district_id', String(district_id));
  return apiFetch<ConstituencySearchHit[]>(`/search/constituencies?${params}`);
}

export function searchCandidates(q: string, election_id?: string) {
  const params = new URLSearchParams({ q });
  if (election_id) params.set('election_id', election_id);
  return apiFetch<Candidate[]>(`/search/candidates?${params}`);
}
