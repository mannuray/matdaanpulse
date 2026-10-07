import type { LeaderChange } from './liveUpdates';
import type { Upset } from '../derive/seatAnalysis';
import { displayNameFromConstId } from '../geo/regionMatching';

export interface TickerEvent {
  id: string;
  constId: string;
  constName: string;
  partyId: string;
  /** 'won' declared; 'lead' a first lead; 'switch' the lead moved from `prevParty`; 'upset' a new upset in the seat. */
  kind: 'won' | 'lead' | 'switch' | 'upset';
  prevParty?: string;
  upset?: Upset;
  margin: number;
  at: number;
}

export const MAX_TICKER = 20;

export function appendTicker(prev: TickerEvent[], changes: LeaderChange[], now: number = Date.now(), upsets: { const_id: string; upset: Upset }[] = []): TickerEvent[] {
  if (changes.length === 0 && upsets.length === 0) return prev;
  const added = changes.map((c, i): TickerEvent => ({
    id: `${c.const_id}-${now}-${i}`,
    constId: c.const_id,
    constName: displayNameFromConstId(c.const_id),
    partyId: c.party_id,
    kind: c.kind === 'lead' && c.prevParty && c.prevParty !== c.party_id ? 'switch' : c.kind,
    ...(c.prevParty && c.prevParty !== c.party_id ? { prevParty: c.prevParty } : {}),
    margin: c.margin,
    at: now,
  }));
  const upsetEvents = upsets.map((u, i): TickerEvent => ({
    id: `${u.const_id}-${now}-u${i}`,
    constId: u.const_id,
    constName: displayNameFromConstId(u.const_id),
    partyId: '',
    kind: 'upset',
    upset: u.upset,
    margin: 0,
    at: now,
  }));
  return [...[...added, ...upsetEvents].reverse(), ...prev].slice(0, MAX_TICKER);
}
