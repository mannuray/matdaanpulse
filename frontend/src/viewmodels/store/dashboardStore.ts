import type { LayerId, Highlight } from '../../model/types/dashboard';

export type FocusTile = 'map' | 'scoreboard' | 'standings' | 'insight' | 'leaders' | 'stats';
export type MapMode = 'map' | 'hex';

export interface DashboardUiState {
  layer: LayerId;
  mapMode: MapMode;
  selectedSeat: string | null;
  selectedParty: string | null;
  hover: Highlight | null;
  locked: { chipId: string; highlight: Highlight; label: string } | null;
  focus: FocusTile | null;
}

export type DashboardAction =
  | { type: 'setLayer'; layer: LayerId }
  | { type: 'setMapMode'; mode: MapMode }
  | { type: 'selectSeat'; seat: string | null }
  | { type: 'selectParty'; party: string | null }
  | { type: 'hover'; highlight: Highlight | null }
  | { type: 'toggleLock'; chipId: string; highlight: Highlight; label: string }
  | { type: 'clearLock' }
  /** Live data changed a locked row's seats: swap in the fresh highlight (no-op when another row is locked). */
  | { type: 'refreshLock'; chipId: string; highlight: Highlight }
  | { type: 'focus'; tile: FocusTile | null }
  | { type: 'syncFromUrl'; params: Partial<DashboardUiState> };

export const initialUiState: DashboardUiState = { layer: 'overview', mapMode: 'map', selectedSeat: null, selectedParty: null, hover: null, locked: null, focus: null };

const FOCUS_TILES: FocusTile[] = ['map', 'scoreboard', 'standings', 'insight', 'leaders', 'stats'];

export function dashboardReducer(s: DashboardUiState, a: DashboardAction): DashboardUiState {
  switch (a.type) {
    case 'setLayer': return { ...s, layer: a.layer, locked: null, hover: null };
    case 'setMapMode': return { ...s, mapMode: a.mode };
    case 'selectSeat': return { ...s, selectedSeat: a.seat };
    case 'selectParty': return { ...s, selectedParty: a.party };
    case 'hover': return { ...s, hover: a.highlight };
    case 'toggleLock': return { ...s, locked: s.locked?.chipId === a.chipId ? null : { chipId: a.chipId, highlight: a.highlight, label: a.label } };
    case 'clearLock': return { ...s, locked: null };
    case 'refreshLock': return s.locked?.chipId === a.chipId ? { ...s, locked: { ...s.locked, highlight: a.highlight } } : s;
    case 'focus': return { ...s, focus: a.tile };
    case 'syncFromUrl': return { ...s, ...a.params };
  }
}

export function activeHighlight(s: DashboardUiState): { parties: Set<string>; seats: Set<string> } {
  // Hover previews over a locked highlight; an empty hover (a row that names no seats) leaves the lock showing.
  const hover = s.hover && (s.hover.parties.length > 0 || s.hover.seats.length > 0) ? s.hover : null;
  const h = hover ?? s.locked?.highlight;
  return { parties: new Set(h?.parties ?? []), seats: new Set(h?.seats ?? []) };
}

export const ALL_LAYERS: LayerId[] = ['overview', 'battle', 'swing', 'history', 'demographics', 'insights', 'states'];

export function parseUiParams(params: URLSearchParams, knownSeats: Set<string> | null, knownParties: Set<string> | null = null): Partial<DashboardUiState> {
  const layer = params.get('layer') as LayerId | null;
  const focus = params.get('focus') as FocusTile | null;
  const seat = params.get('seat');
  const party = params.get('party');
  return {
    layer: layer && ALL_LAYERS.includes(layer) ? layer : 'overview',
    selectedSeat: seat && (knownSeats === null || knownSeats.has(seat)) ? seat : null,
    selectedParty: party && (knownParties === null || knownParties.has(party)) ? party : null,
    focus: focus && FOCUS_TILES.includes(focus) ? focus : null,
  };
}

export function effectiveLayer(requested: LayerId, allowed: LayerId[]): LayerId {
  return allowed.includes(requested) ? requested : 'overview';
}

export function serializeUiParams(s: DashboardUiState, base: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  ['layer', 'seat', 'party', 'focus'].forEach(k => p.delete(k));
  if (s.layer !== 'overview') p.set('layer', s.layer);
  if (s.selectedSeat) p.set('seat', s.selectedSeat);
  if (s.selectedParty) p.set('party', s.selectedParty);
  if (s.focus) p.set('focus', s.focus);
  return p;
}
