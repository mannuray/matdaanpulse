import { apiFetch, API_BASE_URL } from './api-client';
import type { 
  Election, ResultRow, Alliance, VoteShare, Manifest, 
  Constituency, AnalysisEntry, ConstituencyAnalysisDetail 
} from '../types';

/**
 * Election & Constituency Services (SOLID: SRP)
 */

const geoCache = new Map<string, GeoJSON.FeatureCollection>();

export const ElectionService = {
  getCacheKey(id: string, sub?: string) {
    return sub ? `election_${id}_${sub}` : `election_${id}`;
  },

  getElectionsCacheKey() {
    return 'elections_list';
  },

  getConstituencyCacheKey(eid: string, cid: string) {
    return `constituency_${eid}_${cid}`;
  },

  /**
   * Optimized GeoJSON fetching with internal LRU-style cache (SOLID: Performance)
   */
  async getGeoJSON(url: string): Promise<GeoJSON.FeatureCollection> {
    if (geoCache.has(url)) return geoCache.get(url)!;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load map asset: ${url}`);
    
    const data = await response.json();
    // Basic cache management: clear if too large
    if (geoCache.size > 15) geoCache.clear();
    geoCache.set(url, data);
    return data;
  }
};

export function getElections(filters?: { type?: string; status?: string; state_id?: number; year?: number }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.state_id) params.set('state_id', String(filters.state_id));
  if (filters?.year) params.set('year', String(filters.year));
  const qs = params.toString();
  return apiFetch<Election[]>(`/elections${qs ? `?${qs}` : ''}`);
}

export function getElection(id: string) {
  return apiFetch<Election>(`/elections/${id}`);
}

export function getResults(electionId: string) {
  return apiFetch<ResultRow[]>(`/elections/${electionId}/results`);
}

export function getAlliances(electionId: string) {
  return apiFetch<Alliance[]>(`/elections/${electionId}/alliances`);
}

export function getVoteShare(electionId: string) {
  return apiFetch<VoteShare[]>(`/elections/${electionId}/vote-share`);
}

export function getManifest(electionId: string) {
  return apiFetch<Manifest>(`/elections/${electionId}/manifest`);
}

export function getConstituency(electionId: string, constId: string) {
  return apiFetch<Constituency>(`/elections/${electionId}/constituencies/${constId}`);
}

export function getConstituencyAnalysis(electionId: string, constId: string) {
  return apiFetch<ConstituencyAnalysisDetail>(`/elections/${electionId}/constituencies/${constId}/analysis`);
}

export function getAnalysis(electionId: string) {
  return apiFetch<AnalysisEntry[]>(`/elections/${electionId}/analysis`);
}

export function getDistrictResults(electionId: string, districtId: number) {
  return apiFetch<ResultRow[]>(`/elections/${electionId}/districts/${districtId}/results`);
}

export function compareElections(id: string, toId: string) {
  return apiFetch<{ constituency_1: { const_id: string; results: unknown[] }; constituency_2: { const_id: string; results: unknown[] } }>(
    `/elections/${id}/compare?to=${toId}`
  );
}

export function createSSEConnection(electionId: string): EventSource {
  return new NewEventSource(`${API_BASE_URL}/live/updates?election_id=${electionId}`);
}

/** Internal helper */
function NewEventSource(url: string) {
  return new EventSource(url);
}
