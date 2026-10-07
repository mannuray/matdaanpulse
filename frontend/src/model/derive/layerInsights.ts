import type { ManifestAlliance, SwingEntry, DominanceEntry, IncumbencyEntry, VoteSplitConfig, ResultRow } from '../types';
import type { LayerId, SeatResult } from '../types/dashboard';
import { median } from './marginStats';
import { MOMENTUM_FILL } from './mapColors';
import type { SeatLive } from './seatAnalysis';

export interface InsightChip {
  id: string;
  label: string;
  labelKey?: string;
  color: string;
  fromColor?: string;
  count: number;
  seatIds: string[];
  /** 'split': seats a split faction now holds from the old party (party lineage), shown apart from flips. */
  tag?: 'split';
}

export interface LayerInsight {
  layer: LayerId;
  headlineKey: string;
  headlineParams: Record<string, string | number>;
  chips: InsightChip[];
}

export interface InsightContext {
  electionType: 'LS' | 'VS';
  seats: SeatResult[];
  alliances: ManifestAlliance[];
  partyColor: Map<string, string>;
  swing?: Map<string, SwingEntry>;
  prevYear?: number | null;
  dominance?: Map<string, DominanceEntry>;
  incumbency?: IncumbencyEntry[];
  voteSplits?: VoteSplitConfig[];
  constCandidates?: Map<string, ResultRow[]>;
  threeWaySeats?: Set<string>;
  /** Live counting: per-seat live state (seat analysis Phase B). Absent → the finished-election insights. */
  live?: Map<string, SeatLive>;
}

export const MARGIN_BUCKETS: Record<'LS' | 'VS', { label: string; max: number }[]> = {
  LS: [{ label: '< 5K', max: 5000 }, { label: '5–25K', max: 25000 }, { label: '25–75K', max: 75000 }, { label: '75–200K', max: 200000 }, { label: '200K+', max: Infinity }],
  VS: [{ label: '< 1K', max: 1000 }, { label: '1–5K', max: 5000 }, { label: '5–15K', max: 15000 }, { label: '15–50K', max: 50000 }, { label: '50K+', max: Infinity }],
};
export const CLOSE_THRESHOLD: Record<'LS' | 'VS', number> = { LS: 5000, VS: 1000 };

const MAX_CHIPS = 6;
const ACCENT = 'var(--color-accent)';
const GREY = 'var(--color-fallback)';

const led = (ctx: InsightContext) => ctx.seats.filter(s => s.party && s.margin != null);
/** Seats with a winner, seats won unopposed included: for counting seats (margins use led). */
const won = (ctx: InsightContext) => ctx.seats.filter(s => s.party && (s.margin != null || s.uncontested));
const colorOf = (ctx: InsightContext, party: string) => ctx.partyColor.get(party) ?? GREY;

function partyChips(ctx: InsightContext, seats: SeatResult[]): InsightChip[] {
  const byParty = new Map<string, string[]>();
  seats.forEach(s => byParty.set(s.party, [...(byParty.get(s.party) ?? []), s.id]));
  return [...byParty.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, MAX_CHIPS)
    .map(([party, ids]) => ({ id: party, label: party, color: colorOf(ctx, party), count: ids.length, seatIds: ids }));
}

function allianceOf(ctx: InsightContext): Map<string, ManifestAlliance> {
  const m = new Map<string, ManifestAlliance>();
  ctx.alliances.forEach(a => a.parties.forEach(p => m.set(p, a)));
  return m;
}

function overview(ctx: InsightContext): LayerInsight {
  const seats = won(ctx);
  const al = allianceOf(ctx);
  const counts = new Map<string, number>();
  let others = 0;
  seats.forEach(s => {
    const a = al.get(s.party);
    if (a) counts.set(a.name, (counts.get(a.name) ?? 0) + 1);
    else others++;
  });
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`);
  const othersCount = ctx.alliances.length > 0 ? others : 0;
  return {
    layer: 'overview',
    headlineKey: othersCount > 0 ? 'studio_insight_overview_others' : 'studio_insight_overview',
    headlineParams: { text: parts.join(' · '), others: othersCount },
    chips: [...partyChips(ctx, seats), ...tooCloseChip(ctx)],
  };
}

/** While live: one chip for the seats too close to call (filters the map). */
function tooCloseChip(ctx: InsightContext): InsightChip[] {
  if (!ctx.live) return [];
  const ids = [...ctx.live.values()].filter(s => s.call === 'too_close').map(s => s.const_id);
  return ids.length ? [{ id: 'too_close', label: 'Too close', labelKey: 'studio_chip_too_close', color: MOMENTUM_FILL.narrowing, count: ids.length, seatIds: ids }] : [];
}

/** Battle while live: lead changes, and where the leads are moving (spec §3.2). */
function battleLive(live: Map<string, SeatLive>): LayerInsight {
  const all = [...live.values()];
  const ids = (f: (s: SeatLive) => boolean) => all.filter(f).map(s => s.const_id);
  const chip = (id: string, labelKey: string, color: string, seatIds: string[]): InsightChip => ({ id, label: id, labelKey, color, count: seatIds.length, seatIds });
  return {
    layer: 'battle',
    headlineKey: 'studio_insight_battle_live',
    headlineParams: { n: all.reduce((s, x) => s + (x.lead_changes ?? 0), 0) },
    chips: [
      chip('mo_switched', 'map_legend_switched', MOMENTUM_FILL.switched, ids(s => s.momentum === 'switched')),
      chip('mo_narrowing', 'map_legend_narrowing', MOMENTUM_FILL.narrowing, ids(s => s.momentum === 'narrowing')),
      chip('mo_widening', 'map_legend_widening', MOMENTUM_FILL.widening, ids(s => s.momentum === 'widening')),
      chip('comebacks', 'studio_chip_comebacks', ACCENT, ids(s => s.comeback)),
      chip('upsets', 'studio_chip_upsets', 'var(--color-live)', ids(s => s.upsets.length > 0)),
    ],
  };
}

function battle(ctx: InsightContext): LayerInsight {
  if (ctx.live) return battleLive(ctx.live);
  const seats = led(ctx);
  const buckets = MARGIN_BUCKETS[ctx.electionType];
  const threshold = CLOSE_THRESHOLD[ctx.electionType];
  const chips = buckets.map((b, i): InsightChip => {
    const lo = i === 0 ? -Infinity : buckets[i - 1].max;
    const ids = seats.filter(s => s.margin! >= lo && s.margin! < b.max).map(s => s.id);
    return { id: `bucket-${i}`, label: b.label, color: ACCENT, count: ids.length, seatIds: ids };
  });
  const margins = seats.map(s => s.margin!).sort((a, b) => a - b);
  return {
    layer: 'battle',
    headlineKey: 'studio_insight_battle',
    headlineParams: { median: median(margins), close: margins.filter(m => m < threshold).length, threshold },
    chips,
  };
}

function swing(ctx: InsightContext): LayerInsight | null {
  if (!ctx.swing || ctx.swing.size === 0) return null;
  const flows = new Map<string, { prev: string; cur: string; ids: string[]; split: boolean }>();
  let flipped = 0;
  for (const e of ctx.swing.values()) {
    if (!e.flipped && !e.split) continue;
    if (e.flipped) flipped++;
    const key = `${e.split ? 'split:' : ''}${e.prevParty}>${e.currentParty}`;
    const f = flows.get(key) ?? { prev: e.prevParty, cur: e.currentParty, ids: [], split: !!e.split };
    f.ids.push(e.constId);
    flows.set(key, f);
  }
  // Flips first (by size), then the split seats.
  const chips = [...flows.entries()]
    .sort((a, b) => Number(a[1].split) - Number(b[1].split) || b[1].ids.length - a[1].ids.length || a[0].localeCompare(b[0]))
    .slice(0, MAX_CHIPS)
    .map(([key, f]): InsightChip => ({ id: key, label: `${f.prev} → ${f.cur}`, fromColor: colorOf(ctx, f.prev), color: colorOf(ctx, f.cur), count: f.ids.length, seatIds: f.ids, ...(f.split ? { tag: 'split' as const } : {}) }));
  return { layer: 'swing', headlineKey: 'studio_insight_swing', headlineParams: { flipped, total: ctx.swing.size, year: ctx.prevYear ?? '' }, chips };
}

function history(ctx: InsightContext): LayerInsight | null {
  if (!ctx.dominance || ctx.dominance.size === 0) return null;
  const by = { stronghold: [] as string[], loyal: [] as string[], swing: [] as string[] };
  for (const d of ctx.dominance.values()) if (d.classification in by) by[d.classification as keyof typeof by].push(d.constId);
  const anti = (ctx.incumbency ?? []).filter(i => !i.won).map(i => i.constId);
  const chip = (id: keyof typeof by | 'anti_incumbency', ids: string[], color: string): InsightChip =>
    ({ id, label: id, labelKey: `studio_chip_${id}`, color, count: ids.length, seatIds: ids });
  return {
    layer: 'history',
    headlineKey: 'studio_insight_history',
    headlineParams: { strongholds: by.stronghold.length, swing: by.swing.length },
    chips: [chip('stronghold', by.stronghold, ACCENT), chip('loyal', by.loyal, ACCENT), chip('swing', by.swing, 'var(--color-map-swing)'), chip('anti_incumbency', anti, 'var(--color-live)')],
  };
}

function reserved(ctx: InsightContext): LayerInsight | null {
  const res = won(ctx).filter(s => s.type === 'SC' || s.type === 'ST');
  const sc = ctx.seats.filter(s => s.type === 'SC').length;
  const st = ctx.seats.filter(s => s.type === 'ST').length;
  if (sc + st === 0) return null;
  return { layer: 'demographics', headlineKey: 'studio_insight_reserved', headlineParams: { sc, st }, chips: partyChips(ctx, res) };
}

function insights(ctx: InsightContext): LayerInsight {
  const splits = ctx.voteSplits ?? [];
  if (splits.length > 0 && ctx.constCandidates) {
    const al = allianceOf(ctx);
    const union = new Set<string>();
    const chips = splits.map((cfg): InsightChip => {
      const ids: string[] = [];
      for (const [id, cands] of ctx.constCandidates!) {
        if (cands.length < 2) continue;
        const [w, r] = cands;
        const spoiler = cands.find(c => c.party_id === cfg.spoiler);
        if (spoiler && spoiler !== w && spoiler.votes > w.votes - r.votes && al.get(r.party_id)?.id === cfg.hurts) ids.push(id);
      }
      ids.forEach(i => union.add(i));
      return { id: cfg.spoiler, label: cfg.label, color: colorOf(ctx, cfg.spoiler), count: ids.length, seatIds: ids };
    });
    return { layer: 'insights', headlineKey: 'studio_insight_spoilers', headlineParams: { count: union.size }, chips };
  }
  const three = [...(ctx.threeWaySeats ?? [])];
  return { layer: 'insights', headlineKey: 'studio_insight_threeway', headlineParams: { count: three.length }, chips: [] };
}

function states(ctx: InsightContext): LayerInsight | null {
  if (ctx.electionType !== 'LS') return null;
  const al = allianceOf(ctx);
  const byState = new Map<string, SeatResult[]>();
  won(ctx).forEach(s => { if (s.state) byState.set(s.state, [...(byState.get(s.state) ?? []), s]); });
  const leaders = new Map<string, { a: ManifestAlliance; states: number; seatIds: string[] }>();
  for (const seats of byState.values()) {
    const tally = new Map<string, number>();
    seats.forEach(s => { const a = al.get(s.party); if (a) tally.set(a.id, (tally.get(a.id) ?? 0) + 1); });
    const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
    if (!top) continue;
    const a = ctx.alliances.find(x => x.id === top[0])!;
    const entry = leaders.get(a.id) ?? { a, states: 0, seatIds: [] };
    entry.states++;
    entry.seatIds.push(...seats.map(s => s.id));
    leaders.set(a.id, entry);
  }
  const chips = [...leaders.values()].sort((x, y) => y.states - x.states)
    .map(l => ({ id: l.a.id, label: l.a.name, color: l.a.color, count: l.states, seatIds: l.seatIds }));
  return { layer: 'states', headlineKey: 'studio_insight_states', headlineParams: { states: byState.size }, chips };
}

export function deriveLayerInsight(layer: LayerId, ctx: InsightContext): LayerInsight | null {
  switch (layer) {
    case 'overview': return overview(ctx);
    case 'battle': return battle(ctx);
    case 'swing': return swing(ctx);
    case 'history': return history(ctx);
    case 'demographics': return reserved(ctx);
    case 'insights': return insights(ctx);
    case 'states': return states(ctx);
    // Regions keep the seat colours of Overview, so the strip shows the same party chips.
    case 'regions': return overview(ctx);
  }
}
