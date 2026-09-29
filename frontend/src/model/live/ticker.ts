import type { LeaderChange } from './liveUpdates';
import { displayNameFromConstId } from '../geo/regionMatching';

export interface TickerEvent {
  id: string;
  constId: string;
  constName: string;
  partyId: string;
  kind: 'won' | 'lead';
  margin: number;
  at: number;
}

export const MAX_TICKER = 20;

export function appendTicker(prev: TickerEvent[], changes: LeaderChange[], now: number = Date.now()): TickerEvent[] {
  if (changes.length === 0) return prev;
  const added = changes.map((c, i): TickerEvent => ({
    id: `${c.const_id}-${now}-${i}`,
    constId: c.const_id,
    constName: displayNameFromConstId(c.const_id),
    partyId: c.party_id,
    kind: c.kind,
    margin: c.margin,
    at: now,
  }));
  return [...added.reverse(), ...prev].slice(0, MAX_TICKER);
}
