import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ThemeName } from '../../model/derive/themeColor';

export type Theme = ThemeName;
export const THEME_KEY = 'studio_theme';

const listeners = new Set<() => void>();
/** Only set while storage is unavailable, so the toggle still works (for this page only). */
let current: Theme | null = null;

/** Stored theme; anything missing, invalid or unreadable is dark (the studio default). */
export function readTheme(): Theme {
  if (current) return current;
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

/** On <html>, not .studio-root: Radix dialogs and the map tooltip are portaled to body. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function write(theme: Theme): void {
  try { localStorage.setItem(THEME_KEY, theme); current = null; } catch { current = theme; }
  applyTheme(theme);
  listeners.forEach(l => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY) { current = null; applyTheme(readTheme()); cb(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

export interface ThemeVM { theme: Theme; setTheme(t: Theme): void; toggle(): void }

/** Dark/light theme, shared by every consumer (module store, no provider needed) and persisted in localStorage. */
export function useTheme(): ThemeVM {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark' as Theme);
  useEffect(() => { applyTheme(theme); }, [theme]);
  const setTheme = useCallback((t: Theme) => write(t), []);
  const toggle = useCallback(() => write(readTheme() === 'dark' ? 'light' : 'dark'), []);
  return { theme, setTheme, toggle };
}
