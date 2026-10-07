import { MAP_FILL, MOMENTUM_FILL } from './mapFill';
import type { SeatLive } from './seatAnalysis';
import type { LayerId } from '../types/dashboard';

export interface LegendItem { key: string; labelKey: string; color: string; dashed?: boolean; count: number }

/** The live map legend (spec §3): calls on the Overview, momentum on Battle; null when not live or on other layers. */
export function mapLegend(layer: LayerId, live: Map<string, SeatLive> | undefined): LegendItem[] | null {
  if (!live) return null;
  const all = [...live.values()];
  const n = (f: (s: SeatLive) => boolean) => all.filter(f).length;
  if (layer === 'overview') return [
    { key: 'safe', labelKey: 'map_legend_safe', color: 'var(--color-ink)', count: n(s => s.call === 'safe' || s.call === 'declared') },
    { key: 'likely', labelKey: 'map_legend_likely', color: 'var(--color-muted)', count: n(s => s.call === 'likely' || s.call === 'counting') },
    { key: 'too_close', labelKey: 'map_legend_too_close', color: 'var(--color-muted)', dashed: true, count: n(s => s.call === 'too_close') },
    { key: 'not_started', labelKey: 'map_legend_not_started', color: MAP_FILL.pending, count: n(s => s.call === 'not_started') },
  ];
  if (layer === 'battle') return [
    { key: 'switched', labelKey: 'map_legend_switched', color: MOMENTUM_FILL.switched, count: n(s => s.momentum === 'switched') },
    { key: 'narrowing', labelKey: 'map_legend_narrowing', color: MOMENTUM_FILL.narrowing, count: n(s => s.momentum === 'narrowing') },
    { key: 'widening', labelKey: 'map_legend_widening', color: MOMENTUM_FILL.widening, count: n(s => s.momentum === 'widening') },
    { key: 'stable', labelKey: 'map_legend_stable', color: MOMENTUM_FILL.stable, count: n(s => !s.momentum || s.momentum === 'stable') },
  ];
  return null;
}
