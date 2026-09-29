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
    expect(contrastOnWhite(out)!).toBeLessThan(3.3);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(out.slice(i, i + 2), 16));
    expect(r).toBeGreaterThanOrEqual(b);
    expect(g).toBeGreaterThanOrEqual(b);
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
