import { apiFetch } from './api-client';
import type { State } from '../types';

export async function getStates() {
  return (await apiFetch<State[]>('/states')) || [];
}

export async function getDistricts(stateId: number) {
  return (await apiFetch<Array<{ id: number; name: string; code: string }>>(`/states/${stateId}/districts`)) || [];
}

export async function getRegions(stateId: number) {
  return (await apiFetch<Array<{ id: number; name: string; code: string }>>(`/states/${stateId}/regions`)) || [];
}
