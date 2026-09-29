export type ThemeName = 'dark' | 'light';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const MIN_CONTRAST = 3;

function parse(hex: string): [number, number, number] | null {
  if (!HEX.test(hex)) return null;
  const h = hex.slice(1);
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast of a colour against white, or null when `hex` is not a #rgb / #rrggbb colour. */
export function contrastOnWhite(hex: string): number | null {
  const rgb = parse(hex);
  return rgb ? 1.05 / (luminance(rgb) + 0.05) : null;
}

const toHex = (rgb: number[]) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

/**
 * A party colour as it should be drawn on the given theme. Dark keeps the colour; light darkens (same hue,
 * scaled towards black) any colour below 3:1 against white so fills, dots and bars stay visible on light tiles.
 * Anything that is not a hex colour (var(...), names) passes through.
 */
export function forTheme(hex: string, theme: ThemeName): string {
  if (theme === 'dark') return hex;
  const rgb = parse(hex);
  if (!rgb) return hex;
  let k = 1;
  let out = rgb;
  while (luminance(out) > 0 && 1.05 / (luminance(out) + 0.05) < MIN_CONTRAST && k > 0.02) {
    k -= 0.02;
    out = rgb.map(v => v * k) as [number, number, number];
  }
  return k === 1 ? hex : toHex(out);
}
