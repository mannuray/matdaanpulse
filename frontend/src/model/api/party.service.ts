import { apiFetch } from './api-client';
import type { PartyRecord } from '../types';

/** The party's record across elections; `state` (a state code) adds that state's MLAs, seat flow and regions. */
export const getPartyRecord = (id: string, state?: string) =>
  apiFetch<PartyRecord>(`/parties/${encodeURIComponent(id)}/record${state ? `?state=${encodeURIComponent(state)}` : ''}`);
