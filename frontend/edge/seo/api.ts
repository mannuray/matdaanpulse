import type {
  Alliance, Constituency, ConstituencyAnalysisDetail, Election, Manifest, PartyDetail, PartyRecord, PersonDetail, ResultRow, ResultsSnapshot,
} from '../../src/model/types';
import type { LiveState, SeatSummary } from './types';

/** The API answered 404 (unknown id) or 400 (malformed id): the page does not exist. */
export class NotFound extends Error {}

export type Get = <T>(path: string) => Promise<T>;

/** One request's API reader: every call shares `signal` (the 2.5 s budget of the whole page). */
export function makeGet(base: string, fetchImpl: typeof fetch, signal: AbortSignal): Get {
  return async <T>(path: string): Promise<T> => {
    const res = await fetchImpl(`${base}${path}`, { signal, headers: { Accept: 'application/json' } });
    if (res.status === 404 || res.status === 400) throw new NotFound(path);
    if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
    const body = (await res.json()) as { success?: boolean; data?: unknown } | null;
    return (body && typeof body === 'object' && 'success' in body ? body.data : body) as T;
  };
}

/** Absent (404) reads as null; a server error or timeout still fails, so an incomplete page is never cached long. */
const optional = <T>(p: Promise<T>): Promise<T | null> => p.catch(err => { if (err instanceof NotFound) return null; throw err; });

export function seoApi(get: Get) {
  return {
    elections: () => get<Election[]>('/elections'),
    election: (id: string) => get<Election>(`/elections/${id}`),
    manifest: (id: string) => optional(get<Manifest>(`/elections/${id}/manifest`)),
    alliances: (id: string) => get<Alliance[]>(`/elections/${id}/alliances`),
    constituencies: (id: string) => get<SeatSummary[]>(`/constituencies?election_id=${id}`),
    results: (id: string) => get<ResultRow[]>(`/elections/${id}/results`),
    /** The election's live version and status (null when the backend has none). */
    live: (id: string) => optional(get<LiveState>(`/elections/${id}/live`)),
    /** Immutable per version: the same snapshot every viewer's dashboard reads while counting. */
    snapshot: (id: string, version: number) => get<ResultsSnapshot>(`/elections/${id}/results?v=${version}`),
    constituency: (id: string, constId: string, version?: number) =>
      get<Constituency>(`/elections/${id}/constituencies/${encodeURIComponent(constId)}${version != null ? `?v=${version}` : ''}`),
    seatAnalysis: (id: string, constId: string) =>
      optional(get<ConstituencyAnalysisDetail>(`/elections/${id}/constituencies/${encodeURIComponent(constId)}/analysis`)),
    person: (id: string) => get<PersonDetail>(`/candidates/persons/${id}`),
    party: (id: string) => get<PartyDetail>(`/parties/${encodeURIComponent(id)}`),
    partyRecord: (id: string, state: string | null) =>
      get<PartyRecord>(`/parties/${encodeURIComponent(id)}/record${state ? `?state=${encodeURIComponent(state)}` : ''}`),
  };
}

export type SeoApi = ReturnType<typeof seoApi>;
