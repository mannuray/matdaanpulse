import { apiFetch } from './api-client';
import type { 
  Election, ResultRow, Alliance, VoteShare, Manifest, 
  Constituency, AnalysisEntry, ConstituencyAnalysisDetail, ResultsSnapshot
} from '../types';
import type { LiveState } from '../live/poller';
import type { Baseline } from '../derive/seatAnalysis';
import type { SeatRound } from '../derive/liveSeat';
import type { RegionShares } from '../derive/regionComparison';
import { fixWinding } from '../geo/winding';
import { visibleElections } from '../config/houses';

/**
 * Election & Constituency Services (SOLID: SRP)
 */

// Caches the in-flight promise so concurrent callers share a single fetch.
const geoCache = new Map<string, Promise<GeoJSON.FeatureCollection>>();

export const ElectionService = {
  getCacheKey(id: string, sub?: string) {
    return sub ? `election_${id}_${sub}` : `election_${id}`;
  },

  getConstituencyCacheKey(eid: string, cid: string) {
    return `constituency_${eid}_${cid}`;
  },

  /**
   * Optimized GeoJSON fetching with internal LRU-style cache (SOLID: Performance)
   */
  getGeoJSON(url: string): Promise<GeoJSON.FeatureCollection> {
    const cached = geoCache.get(url);
    if (cached) return cached;

    const promise = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Failed to load map asset: ${url}`);
      return response.json() as Promise<GeoJSON.FeatureCollection>;
    }).then(fixWinding);
    // Basic cache management: clear if too large
    if (geoCache.size > 15) geoCache.clear();
    geoCache.set(url, promise);
    // Don't cache failures
    promise.catch(() => { if (geoCache.get(url) === promise) geoCache.delete(url); });
    return promise;
  }
};

export function getElections(filters?: { type?: string; status?: string; state_id?: number; year?: number }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.state_id) params.set('state_id', String(filters.state_id));
  if (filters?.year) params.set('year', String(filters.year));
  const qs = params.toString();
  // Elections of hidden houses (Lok Sabha, for now) never reach a list or picker.
  return apiFetch<Election[]>(`/elections${qs ? `?${qs}` : ''}`).then(visibleElections);
}

export function getElection(id: string) {
  return apiFetch<Election>(`/elections/${id}`);
}

export function getResults(electionId: string) {
  return apiFetch<ResultRow[]>(`/elections/${electionId}/results`);
}

/** Polled (CDN-cached ~5 s): the current live version of an election. */
export function getLiveState(electionId: string) {
  return apiFetch<LiveState>(`/elections/${electionId}/live`);
}

/** Immutable per version; an older version redirects to the current one (fetch follows it). */
export function getResultsSnapshot(electionId: string, version: number) {
  return apiFetch<ResultsSnapshot>(`/elections/${electionId}/results?v=${version}`);
}

export function getAlliances(electionId: string) {
  return apiFetch<Alliance[]>(`/elections/${electionId}/alliances`);
}

export function getVoteShare(electionId: string) {
  return apiFetch<VoteShare[]>(`/elections/${electionId}/vote-share`);
}

/** Per-region party votes and seats (the region comparison after a redraw). */
export function getRegionShares(electionId: string) {
  return apiFetch<RegionShares>(`/elections/${electionId}/region-shares`);
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

/** Pre-counting baseline (seat analysis Phase B). A missing or failed one is null: the dashboard then shows no live seat maps. */
export async function getBaseline(electionId: string): Promise<(Baseline & { computed_at: string }) | null> {
  try { return await apiFetch<(Baseline & { computed_at: string }) | null>(`/elections/${electionId}/baseline`); } catch { return null; }
}

/** A seat's counting timeline (seat dialog margin chart); [] when unavailable. */
export async function getSeatRounds(electionId: string, constId: string): Promise<SeatRound[]> {
  try { return await apiFetch<SeatRound[]>(`/elections/${electionId}/constituencies/${constId}/rounds`); } catch { return []; }
}

export function getAnalysis(electionId: string) {
  return apiFetch<AnalysisEntry[]>(`/elections/${electionId}/analysis`);
}
