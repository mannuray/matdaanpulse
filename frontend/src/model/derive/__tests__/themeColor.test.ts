import { describe, it, expect } from 'vitest';
import { forTheme, contrastOnWhite } from '../themeColor';

describe('forTheme', () => {
  it('passes every colour through on dark', () => {
    expect(forTheme('#FFEB3B', 'dark')).toBe('#FFEB3B');
  });
  it('darkens a pale yellow to at least 3:1 against white on light, keeping the hue order', () => {
    const out = forTheme('#FFEB3B', 'light');
    expect(out).not.toBe('#FFEB3B');
    expect(contrastOnWhite(out)!).toBeGreaterThanOrEqual(3);
    expect(contrastOnWhite(out)!).toBeLessThan(3.2);
  });
  it('keeps the hue within 3 degrees (no olive drift) for a range of pale colours', () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const hex of ['#FFEB3B', '#F59E0B', '#22D3EE', '#A3E635', '#F472B6', '#FDE047']) {
      for (const use of ['fill', 'text'] as const) {
        const out = forTheme(hex, 'light', use);
        const dh = Math.abs(hue(out) - hue(hex));
        expect(Math.min(dh, 360 - dh), `${hex} ${use}`).toBeLessThanOrEqual(3);
      }
    }
  });
  it('text use reaches 4.5:1 (fill only 3:1)', () => {
    for (const hex of ['#FFEB3B', '#F97316', '#3B82F6', '#22C55E']) {
      expect(contrastOnWhite(forTheme(hex, 'light', 'text'))!).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastOnWhite(forTheme('#F97316', 'light', 'fill'))!).toBeLessThan(4.5);
    expect(forTheme('#FFEB3B', 'dark', 'text')).toBe('#FFEB3B');
    expect(forTheme('#1D4ED8', 'light', 'text')).toBe('#1D4ED8');
  });
  it('keeps an already dark colour unchanged', () => {
    expect(forTheme('#1D4ED8', 'light')).toBe('#1D4ED8');
  });
  it('expands 3-digit hex and handles white', () => {
    expect(contrastOnWhite(forTheme('#fff', 'light'))!).toBeGreaterThanOrEqual(3);
  });
  it('passes invalid values through', () => {
    expect(forTheme('var(--map-default-fill)', 'light')).toBe('var(--map-default-fill)');
    expect(forTheme('red', 'light')).toBe('red');
    expect(forTheme('', 'light')).toBe('');
  });
});
