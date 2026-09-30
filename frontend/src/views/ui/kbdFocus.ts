import type { FocusEvent } from 'react';

/** Focus handler that runs only for keyboard focus (not the focus a mouse click leaves behind), so focus previews a highlight like hover does. */
export function onKbdFocus(fn: () => void) {
  return (e: FocusEvent<HTMLElement>) => {
    let visible = true;
    try { visible = e.currentTarget.matches(':focus-visible'); } catch { /* selector unsupported: treat as keyboard */ }
    if (visible) fn();
  };
}
