export type ThemeName = 'dark' | 'light';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

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

function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [((h * 60) + 360) % 360, s, l];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const toHex = (rgb: number[]) => '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** 'fill' = shapes (bars, dots, map): 3:1. 'text' = small text: 4.5:1. */
export type ColorUse = 'fill' | 'text';
const TARGET: Record<ColorUse, number> = { fill: 3, text: 4.5 };

/**
 * A party colour as it should be drawn on the given theme. Dark keeps the colour; light lowers the HSL lightness
 * (hue and saturation kept, so yellow stays yellow-ish rather than going olive-grey) until the colour reaches the
 * target contrast against white. Anything that is not a hex colour (var(...), names) passes through.
 */
export function forTheme(hex: string, theme: ThemeName, use: ColorUse = 'fill'): string {
  if (theme === 'dark') return hex;
  const rgb = parse(hex);
  if (!rgb) return hex;
  const target = TARGET[use];
  if (1.05 / (luminance(rgb) + 0.05) >= target) return hex;
  const [h, sat, l0] = toHsl(rgb);
  let lo = 0, hi = l0;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const c = 1.05 / (luminance(fromHsl(h, sat, mid).map(Math.round) as [number, number, number]) + 0.05);
    if (c >= target) lo = mid; else hi = mid;
  }
  return toHex(fromHsl(h, sat, lo));
}

/** Rows with their `color` adapted to the theme (fill use); the same rows on dark, null / undefined passed through. */
export function recolorRows<R extends { color: string }[] | null | undefined>(rows: R, theme: ThemeName): R {
  if (!rows || theme === 'dark') return rows;
  return rows.map(r => ({ ...r, color: forTheme(r.color, theme) })) as R;
}
