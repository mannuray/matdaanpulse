import type { Dispatch } from 'react';
import type { Highlight } from '../../model/types/dashboard';
import type { DashboardAction } from './dashboardStore';

/** A hover clear waits this long, so moving between rows (across the gap) goes straight from one highlight to the next. */
export const HOVER_CLEAR_DELAY_MS = 100;

export type HoverIntent = ((highlight: Highlight | null) => void) & {
  /** Drop a pending clear (the store is going away). */
  cancel(): void;
};

/** Sets the hover immediately; a clear is delayed and cancelled by the next hover. */
export function createHoverIntent(dispatch: (a: DashboardAction) => void, delay = HOVER_CLEAR_DELAY_MS): HoverIntent {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { if (timer !== undefined) { clearTimeout(timer); timer = undefined; } };
  const intent = (highlight: Highlight | null) => {
    cancel();
    if (highlight) dispatch({ type: 'hover', highlight });
    else timer = setTimeout(() => { timer = undefined; dispatch({ type: 'hover', highlight: null }); }, delay);
  };
  return Object.assign(intent, { cancel });
}

const intents = new WeakMap<object, HoverIntent>();

/** One intent per store (keyed by its stable dispatch), so every hover source shares the same pending-clear timer. */
export function intentFor(dispatch: Dispatch<DashboardAction>): HoverIntent {
  let i = intents.get(dispatch);
  if (!i) { i = createHoverIntent(dispatch); intents.set(dispatch, i); }
  return i;
}
