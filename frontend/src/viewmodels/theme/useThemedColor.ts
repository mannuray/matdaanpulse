import { useMemo } from 'react';
import { forTheme, recolorRows, type ColorUse, type ThemeName } from '../../model/derive/themeColor';
import { useTheme } from './useTheme';

/** Party colours adapted to the current theme. A new object only when the theme changes (safe as a memo dependency). */
export interface ThemedColor {
  theme: ThemeName;
  color(c: string, use?: ColorUse): string;
  rows<R extends { color: string }[] | null | undefined>(rows: R): R;
}

/** The one adapter every VM uses to fit party colours to the theme (model/derive/themeColor). */
export function useThemedColor(): ThemedColor {
  const { theme } = useTheme();
  return useMemo(() => ({
    theme,
    color: (c: string, use: ColorUse = 'fill') => forTheme(c, theme, use),
    rows: <R extends { color: string }[] | null | undefined>(rows: R) => recolorRows(rows, theme),
  }), [theme]);
}
