import type { FocusEvent } from 'react';

/**
 * Focus handler that runs only for keyboard focus (not the focus a mouse click leaves behind), so focus previews a highlight like hover does.
 * Checks the element that received focus (`target`), so it also works on a wrapper that contains the focusable control.
 */
export function onKbdFocus(fn: () => void) {
  return (e: FocusEvent<HTMLElement>) => {
    let visible = true;
    try { visible = (e.target as HTMLElement).matches(':focus-visible'); } catch { /* selector unsupported: treat as keyboard */ }
    if (visible) fn();
  };
}
