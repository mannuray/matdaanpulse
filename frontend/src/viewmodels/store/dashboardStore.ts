import type { LayerId, Highlight } from '../../model/types/dashboard';

export type FocusTile = 'map' | 'scoreboard' | 'standings' | 'insight' | 'leaders' | 'stats';
export type MapMode = 'map' | 'hex';

export interface DashboardUiState {
  layer: LayerId;
  mapMode: MapMode;
  selectedSeat: string | null;
  hover: Highlight | null;
  locked: { chipId: string; highlight: Highlight; label: string } | null;
  focus: FocusTile | null;
}

export type DashboardAction =
  | { type: 'setLayer'; layer: LayerId }
  | { type: 'setMapMode'; mode: MapMode }
  | { type: 'selectSeat'; seat: string | null }
  | { type: 'hover'; highlight: Highlight | null }
  | { type: 'toggleLock'; chipId: string; highlight: Highlight; label: string }
  | { type: 'clearLock' }
  | { type: 'focus'; tile: FocusTile | null }
  | { type: 'syncFromUrl'; params: Partial<DashboardUiState> };

export const initialUiState: DashboardUiState = { layer: 'overview', mapMode: 'map', selectedSeat: null, hover: null, locked: null, focus: null };

const FOCUS_TILES: FocusTile[] = ['map', 'scoreboard', 'standings', 'insight', 'leaders', 'stats'];

export function dashboardReducer(s: DashboardUiState, a: DashboardAction): DashboardUiState {
  switch (a.type) {
    case 'setLayer': return { ...s, layer: a.layer, locked: null, hover: null };
    case 'setMapMode': return { ...s, mapMode: a.mode };
    case 'selectSeat': return a.seat ? { ...s, selectedSeat: a.seat, focus: 'map' } : { ...s, selectedSeat: null };
    case 'hover': return { ...s, hover: a.highlight };
    case 'toggleLock': return { ...s, locked: s.locked?.chipId === a.chipId ? null : { chipId: a.chipId, highlight: a.highlight, label: a.label } };
    case 'clearLock': return { ...s, locked: null };
    case 'focus': return a.tile ? { ...s, focus: a.tile } : { ...s, focus: null, selectedSeat: null };
    case 'syncFromUrl': return { ...s, ...a.params };
  }
}

export function activeHighlight(s: DashboardUiState): { parties: Set<string>; seats: Set<string> } {
  const h = s.locked?.highlight ?? s.hover;
  return { parties: new Set(h?.parties ?? []), seats: new Set(h?.seats ?? []) };
}

export const ALL_LAYERS: LayerId[] = ['overview', 'battle', 'swing', 'history', 'demographics', 'insights', 'states'];

export function parseUiParams(params: URLSearchParams, knownSeats: Set<string> | null): Partial<DashboardUiState> {
  const layer = params.get('layer') as LayerId | null;
  const focus = params.get('focus') as FocusTile | null;
  const seat = params.get('seat');
  return {
    layer: layer && ALL_LAYERS.includes(layer) ? layer : 'overview',
    selectedSeat: seat && (knownSeats === null || knownSeats.has(seat)) ? seat : null,
    focus: focus && FOCUS_TILES.includes(focus) ? focus : null,
  };
}

export function effectiveLayer(requested: LayerId, allowed: LayerId[]): LayerId {
  return allowed.includes(requested) ? requested : 'overview';
}

export function serializeUiParams(s: DashboardUiState, base: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  ['layer', 'seat', 'focus'].forEach(k => p.delete(k));
  if (s.layer !== 'overview') p.set('layer', s.layer);
  if (s.selectedSeat) p.set('seat', s.selectedSeat);
  if (s.focus) p.set('focus', s.focus);
  return p;
}
