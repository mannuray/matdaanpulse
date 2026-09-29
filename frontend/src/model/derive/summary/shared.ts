import type { ManifestAlliance } from '../../types';
import type { SeatResult } from '../../types/dashboard';
import { MARGIN_BUCKETS } from '../layerInsights';
import type { SeatRef } from '../stats';
import type { SummaryContext, SummaryRow } from './types';

/** Legacy fallback dot colour (summary/*Section.tsx used '#6b7280'). */
export const FALLBACK_COLOR = '#6b7280';

/** Legacy `constId.replace(/^[A-Z]{2}_(?:VS\d*_)?(?:\d+_)?/, '')…` (HistorySection.tsx:82). */
export function shortName(id: string): string {
  return id.replace(/^[A-Z]{2}_(?:VS\d*_)?(?:\d+_)?/, '').replace(/_/g, ' ');
}

export const seatLabel = (name: string) => name.replace(/_/g, ' ');

/** Seats that currently have a leader (WON or LEADING): legacy `r.margin != null && r.party`. */
export function ledSeats(ctx: Pick<SummaryContext, 'seats'>): SeatResult[] {
  return ctx.seats.filter(s => s.party && s.margin != null);
}

export function colorOf(ctx: Pick<SummaryContext, 'partyColor'>, party: string): string {
  return ctx.partyColor.get(party) ?? FALLBACK_COLOR;
}

export function partyName(ctx: Pick<SummaryContext, 'parties'>, party: string): string {
  return ctx.parties.find(p => p.id === party)?.name ?? party;
}

export function allianceByParty(alliances: ManifestAlliance[]): Map<string, ManifestAlliance> {
  const m = new Map<string, ManifestAlliance>();
  alliances.forEach(a => a.parties.forEach(p => m.set(p, a)));
  return m;
}

/** A group of parties the summary tallies together: an alliance, or a single party. */
export interface Group { id: string; name: string; color: string; partyIds: string[] }

export function allianceGroups(alliances: ManifestAlliance[]): Group[] {
  return alliances.map(a => ({ id: a.id, name: a.name, color: a.color, partyIds: a.parties }));
}

/** Alliances when the manifest defines them, otherwise every party that leads a seat. */
export function groupsFor(ctx: SummaryContext, seats: SeatResult[]): Group[] {
  if (ctx.alliances.length > 0) return allianceGroups(ctx.alliances);
  const ids = [...new Set(seats.map(s => s.party))];
  return ids.map(id => ({ id, name: partyName(ctx, id), color: colorOf(ctx, id), partyIds: [id] }));
}

/** Legacy bucketing: first bucket with `m < max`, the last bucket catches the rest. */
export function bucketIndex(margin: number, buckets: { max: number }[]): number {
  for (let i = 0; i < buckets.length; i++) if (margin < buckets[i].max || i === buckets.length - 1) return i;
  return buckets.length - 1;
}

export function buckets(ctx: Pick<SummaryContext, 'electionType'>) {
  return MARGIN_BUCKETS[ctx.electionType];
}

export const avg = (sum: number, n: number): number | null => (n > 0 ? Math.round(sum / n) : null);

export const int = (value: number | null) => ({ value, format: 'int' as const });
export const pct = (value: number | null) => ({ value, format: 'pct' as const });
export const signed = (value: number | null) => ({ value, format: 'signed' as const });


export function refRow(ref: SeatRef, color: string, sub: string | undefined = ref.party): SummaryRow {
  return { id: `seat:${ref.id}`, label: seatLabel(ref.name), sub, value: ref.margin, valueFormat: 'int', color, seatIds: [ref.id], partyIds: ref.party ? [ref.party] : [] };
}
