import type { SwingEntry } from '../types';
import type { SeatResult } from '../types/dashboard';

export interface SeatRef {
  id: string;
  name: string;
  party: string;
  /** null for a seat won unopposed */ margin: number | null;
}

export interface DashboardStats {
  declared: number;
  total: number;
  closest: SeatRef | null;
  biggest: SeatRef | null;
  flipped: number | null;
}

const toRef = (s: SeatResult): SeatRef => ({ id: s.id, name: s.name, party: s.party, margin: s.margin ?? null });

/** Declared seats if any, otherwise leading seats — the pool the stats talk about. */
function pool(seats: SeatResult[]): SeatResult[] {
  const withMargin = seats.filter(s => s.margin != null && s.party);
  const won = withMargin.filter(s => s.status === 'WON');
  return won.length > 0 ? won : withMargin.filter(s => s.status === 'LEADING');
}

export function rankSeats(seats: SeatResult[], order: 'closest' | 'biggest', limit: number): SeatRef[] {
  const sorted = [...pool(seats)].sort((a, b) => (order === 'closest' ? a.margin! - b.margin! : b.margin! - a.margin!));
  return sorted.slice(0, limit).map(toRef);
}

export function flippedSeatRefs(seats: SeatResult[], swing: Map<string, SwingEntry>): SeatRef[] {
  return seats
    .filter(s => swing.get(s.id)?.flipped && (s.margin != null || s.uncontested))
    .sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity)) // a flip won unopposed lists last
    .map(toRef);
}

export function deriveStats(seats: SeatResult[], totalSeats: number, swing: Map<string, SwingEntry> | null): DashboardStats {
  let flipped: number | null = null;
  if (swing && swing.size > 0) {
    flipped = 0;
    for (const e of swing.values()) if (e.flipped) flipped++;
  }
  return {
    declared: seats.filter(s => s.status === 'WON').length,
    total: totalSeats,
    closest: rankSeats(seats, 'closest', 1)[0] ?? null,
    biggest: rankSeats(seats, 'biggest', 1)[0] ?? null,
    flipped,
  };
}
