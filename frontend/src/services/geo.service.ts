import { apiFetch } from './api-client';
import type { State, District, Party } from '../types';

/**
 * Geographic & Party Master Data (SOLID: SRP)
 */

export function getStates() {
  return apiFetch<State[]>('/states');
}

export function getDistricts(stateId: number) {
  return apiFetch<District[]>(`/states/${stateId}/districts`);
}

export function getParties() {
  return apiFetch<Party[]>('/parties');
}
