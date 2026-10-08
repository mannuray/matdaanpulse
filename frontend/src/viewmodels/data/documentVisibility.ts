import type { Visibility } from '../../model/live/poller';

/** The tab's visibility for the live pollers (paused while hidden). */
export const documentVisibility: Visibility = {
  isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  subscribe: (onChange) => {
    if (typeof document === 'undefined') return () => undefined;
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  },
};
