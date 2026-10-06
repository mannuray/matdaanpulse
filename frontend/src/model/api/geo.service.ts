import { apiFetch } from './api-client';
import type { State, Party, PartyDetail, LineageEvent } from '../types';

/**
 * Geographic & Party Master Data (SOLID: SRP)
 */

export function getStates() {
  return apiFetch<State[]>('/states');
}

export function getParties() {
  return apiFetch<Party[]>('/parties');
}

export function getParty(id: string) {
  return apiFetch<PartyDetail>(`/parties/${encodeURIComponent(id)}`);
}

/** Every party lineage event (renames, mergers, splits), oldest first. */
export function getPartyLineage() {
  return apiFetch<LineageEvent[]>('/parties/lineage');
}
