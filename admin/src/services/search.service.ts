import { apiFetch } from './api-client';

/** Rows from the public /search endpoints: seats are the public seat summary (ConstituencySearchHitDto, with
 * `district: { id, name }`); candidates are the public summary (CandidateSearchHitDto: no affidavit), so neither is
 * the admin `Constituency` / `Candidate`. */
export interface SeatHit { id: string; name: string; const_no: number; election_id: string; type: string }
export interface CandidateHit { id: string; name: string; election_id: string; const_id: string; party_id: string | null }

/** Seats by name in one election (max 50, server-side). */
export async function searchSeats(q: string, electionId: string): Promise<SeatHit[]> {
  const params = new URLSearchParams({ q });
  if (electionId) params.set('election_id', electionId);
  return (await apiFetch<SeatHit[]>(`/search/constituencies?${params.toString()}`)) || [];
}

/** Candidates by name across every election, or within one when `electionId` is given (max 50, server-side). */
export async function searchCandidatesAll(q: string, electionId?: string): Promise<CandidateHit[]> {
  const params = new URLSearchParams({ q });
  if (electionId) params.set('election_id', electionId);
  return (await apiFetch<CandidateHit[]>(`/search/candidates?${params.toString()}`)) || [];
}
