import type { SwingEntry, DominanceEntry } from '../types';
import type { LayerId, SeatResult } from '../types/dashboard';
import { MARGIN_BUCKETS } from './layerInsights';

/** `highlighted`: part of the active hover/lock highlight (drawn at full strength with an outline). */
export interface SeatFill { color: string; opacity: number; highlighted: boolean }

export interface FillContext {
  layer: LayerId;
  electionType: 'LS' | 'VS';
  partyColor: Map<string, string>;
  swing?: Map<string, SwingEntry>;
  dominance?: Map<string, DominanceEntry>;
  spoilerSeats?: Set<string>;
  threeWaySeats?: Set<string>;
  highlight: { parties: Set<string>; seats: Set<string> };
}

export const MAP_FILL = {
  pending: 'var(--color-map-pending)',
  swing: 'var(--color-map-swing)',
  threeWay: 'var(--color-map-threeway)',
};
export const DIM_OPACITY = 0.12;
/** The bright outline only helps find a few seats; above this many highlighted seats opacity alone carries the highlight. */
export const OUTLINE_MAX = 40;

export const showOutline = (highlightedCount: number) => highlightedCount <= OUTLINE_MAX;
const HELD_OPACITY = 0.18;
const LOYAL_OPACITY = 0.55;
const BUCKET_OPACITY = [0.25, 0.45, 0.65, 0.85, 1];

export function marginOpacity(margin: number | undefined, electionType: 'LS' | 'VS'): number {
  if (margin == null) return 1;
  const buckets = MARGIN_BUCKETS[electionType];
  const i = buckets.findIndex(b => margin < b.max);
  return BUCKET_OPACITY[i < 0 ? BUCKET_OPACITY.length - 1 : i];
}

type LayerFill = Omit<SeatFill, 'highlighted'>;

function layerFill(seat: SeatResult, ctx: FillContext): LayerFill {
  const color = ctx.partyColor.get(seat.party) ?? 'var(--color-fallback)';
  switch (ctx.layer) {
    case 'battle':
      return { color, opacity: marginOpacity(seat.margin, ctx.electionType) };
    case 'swing': {
      const e = ctx.swing?.get(seat.id);
      return e?.flipped ? { color, opacity: 1 } : { color, opacity: HELD_OPACITY };
    }
    case 'history': {
      const d = ctx.dominance?.get(seat.id);
      if (!d || d.classification === 'new') return { color: MAP_FILL.pending, opacity: 1 };
      if (d.classification === 'swing') return { color: MAP_FILL.swing, opacity: 1 };
      const dc = ctx.partyColor.get(d.dominantParty ?? '') ?? color;
      return { color: dc, opacity: d.classification === 'stronghold' ? 1 : LOYAL_OPACITY };
    }
    case 'demographics':
      return { color, opacity: seat.type === 'GEN' ? DIM_OPACITY : 1 };
    case 'insights':
      if (ctx.spoilerSeats?.has(seat.id)) return { color, opacity: 1 };
      if (ctx.threeWaySeats?.has(seat.id)) return { color: MAP_FILL.threeWay, opacity: 1 };
      return { color, opacity: DIM_OPACITY };
    default:
      return { color, opacity: 1 };
  }
}

export function seatFill(seat: SeatResult, ctx: FillContext): SeatFill {
  const fill = !seat.party ? { color: MAP_FILL.pending, opacity: 1 } : layerFill(seat, ctx);
  const { parties, seats } = ctx.highlight;
  if (parties.size === 0 && seats.size === 0) return { ...fill, highlighted: false };
  // Highlighted seats keep the layer colour but ignore its opacity (Battle's faint close seats included).
  if (seats.has(seat.id) || parties.has(seat.party)) return { color: fill.color, opacity: 1, highlighted: true };
  return { ...fill, opacity: DIM_OPACITY, highlighted: false };
}

export function seatFills(seats: SeatResult[], ctx: FillContext): Map<string, SeatFill> {
  const out = new Map<string, SeatFill>();
  for (const s of seats) out.set(s.id, seatFill(s, ctx));
  // A highlight that lights no seat at all (e.g. a party with 0 seats) must not dim the whole map.
  if ((ctx.highlight.parties.size > 0 || ctx.highlight.seats.size > 0) && ![...out.values()].some(f => f.highlighted)) {
    const plain = { ...ctx, highlight: { parties: new Set<string>(), seats: new Set<string>() } };
    for (const s of seats) out.set(s.id, seatFill(s, plain));
  }
  return out;
}
