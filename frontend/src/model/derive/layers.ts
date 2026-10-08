import type { LayerId } from '../types/dashboard';

/** What decides whether a map layer is offered for an election. */
export interface LayerContext {
  electionType: 'LS' | 'VS';
  /** Some seat has a swing entry (a previous comparable election). */
  hasSwing: boolean;
  /** Some seat has a dominance entry (seat history). */
  hasHistory: boolean;
}

export interface LayerDef {
  id: LayerId;
  available(ctx: LayerContext): boolean;
}

const always = () => true;

/** Every map layer, in menu order: the one place that knows which layers exist and when each is offered. */
export const LAYERS: readonly LayerDef[] = [
  { id: 'overview', available: always },
  { id: 'battle', available: always },
  { id: 'swing', available: c => c.hasSwing },
  { id: 'history', available: c => c.hasHistory },
  // Every Vidhan Sabha election (its seats carry regions; the layer shows an empty summary otherwise).
  { id: 'regions', available: c => c.electionType === 'VS' },
  { id: 'demographics', available: always },
  { id: 'insights', available: always },
  { id: 'states', available: c => c.electionType === 'LS' },
];

export const LAYER_IDS: readonly LayerId[] = LAYERS.map(l => l.id);

export function availableLayers(ctx: LayerContext): LayerId[] {
  return LAYERS.filter(l => l.available(ctx)).map(l => l.id);
}
