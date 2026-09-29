import type { ManifestAlliance } from '../types';
import type { PartySeats } from '../types/dashboard';
import { roundPct } from './scoreboard';

export interface StandingRow {
  id: string;
  name: string;
  color: string;
  seats: number;
  votePct: number | null;
  allianceId: string | null;
}

export function deriveStandingRows(
  parties: PartySeats[],
  votePct: Map<string, number>,
  alliances: ManifestAlliance[],
  { includeZero = false }: { includeZero?: boolean } = {},
): StandingRow[] {
  const allianceOf = new Map<string, string>();
  alliances.forEach(a => a.parties.forEach(p => allianceOf.set(p, a.id)));
  return parties
    .filter(p => includeZero || p.seats > 0)
    .map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      seats: p.seats,
      votePct: votePct.has(p.id) ? roundPct(votePct.get(p.id)!) : null,
      allianceId: allianceOf.get(p.id) ?? null,
    }))
    .sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));
}

export interface CompactList<T> {
  visible: T[];
  moreCount: number;
  moreSeats: number;
}

export function compactList<T extends { seats: number }>(rows: T[], count: number): CompactList<T> {
  const visible = rows.slice(0, Math.max(0, count));
  const hidden = rows.slice(visible.length);
  return { visible, moreCount: hidden.length, moreSeats: hidden.reduce((s, r) => s + r.seats, 0) };
}
