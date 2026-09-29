import { describe, it, expect } from 'vitest';
import { fitCount } from '../fit';

describe('fitCount', () => {
  it('shows everything when it fits, with no footer', () => {
    expect(fitCount({ available: 400, itemHeight: 36, gap: 4, total: 5, footerHeight: 24 })).toEqual({ count: 5, overflow: 0 });
  });
  it('reserves footer space when items overflow', () => {
    // (300 - 24 + 4) / 40 = 7 rows, 33 hidden
    expect(fitCount({ available: 300, itemHeight: 36, gap: 4, total: 40, footerHeight: 24 })).toEqual({ count: 7, overflow: 33 });
  });
  it('always shows at least one row on very short tiles (1280x720 / ~650px windows)', () => {
    expect(fitCount({ available: 30, itemHeight: 36, gap: 4, total: 12, footerHeight: 24 })).toEqual({ count: 1, overflow: 11 });
  });
  it('before measurement (0px) shows one row instead of none', () => {
    expect(fitCount({ available: 0, itemHeight: 36, total: 3 })).toEqual({ count: 1, overflow: 2 });
  });
  it('handles an empty list', () => {
    expect(fitCount({ available: 300, itemHeight: 36, total: 0 })).toEqual({ count: 0, overflow: 0 });
  });
});
