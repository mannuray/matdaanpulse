import type { ResultRow } from '../types';

export type SeatResultForParty = 'won' | 'lost' | 'none';
export interface PartySeatFill { color: string; opacity: number; result: SeatResultForParty }

/** The party page map: seats won in the party colour, contested and lost as a faint tint, not contested pending. */
export function partySeatFills(partyId: string, rows: ResultRow[], color: string): Map<string, PartySeatFill> {
  const out = new Map<string, PartySeatFill>();
  for (const r of rows) {
    const cur = out.get(r.const_id);
    if (r.party_id === partyId) out.set(r.const_id, r.status === 'WON' ? { color, opacity: 1, result: 'won' } : cur?.result === 'won' ? cur : { color, opacity: 0.25, result: 'lost' });
    else if (!cur) out.set(r.const_id, { color: 'var(--color-map-pending)', opacity: 1, result: 'none' });
  }
  return out;
}
