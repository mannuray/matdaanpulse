import type { MapTab } from './index';

/** Map layer identifiers. Same values as the legacy MapTab. */
export type LayerId = MapTab;

/** A party with its current seat count (won + leading). */
export interface PartySeats {
  id: string;
  name: string;
  color: string;
  seats: number;
}

/** One constituency's current headline result. */
export interface SeatResult {
  id: string;
  name: string;
  /** GeoJSON st_name, when known (LS). */
  state?: string;
  /** Leading/winning party id, '' when pending. */
  party: string;
  /** Leader's margin; undefined when no leader yet, or for a seat won unopposed. */
  margin?: number;
  /** Won unopposed (no poll): counted and coloured, but no margin, turnout or swing. */
  uncontested?: true;
  /** WON | LEADING | PENDING */
  status: string;
  type: 'GEN' | 'SC' | 'ST';
}

/** A set of seats/parties to emphasise on the map. */
export interface Highlight {
  parties: string[];
  seats: string[];
}
