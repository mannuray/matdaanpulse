import { describe, it, expect } from 'vitest';
import { parseSeatNumber, toOptionalNumber } from './numbers';

describe('toOptionalNumber', () => {
  it('keeps 0 and parses grouped numbers', () => {
    expect(toOptionalNumber('0')).toBe(0);
    expect(toOptionalNumber(0)).toBe(0);
    expect(toOptionalNumber('1,234')).toBe(1234);
    expect(toOptionalNumber(' 61.5 ')).toBe(61.5);
  });
  it('empty or junk → null', () => {
    expect(toOptionalNumber('')).toBeNull();
    expect(toOptionalNumber('  ')).toBeNull();
    expect(toOptionalNumber(null)).toBeNull();
    expect(toOptionalNumber('abc')).toBeNull();
    expect(toOptionalNumber(Number.NaN)).toBeNull();
  });
});

describe('parseSeatNumber', () => {
  it('accepts whole numbers from 1', () => {
    expect(parseSeatNumber('142')).toBe(142);
    expect(parseSeatNumber(7)).toBe(7);
  });
  it('rejects 0, negatives, decimals and junk', () => {
    for (const v of ['0', '-3', '1.5', 'abc', '']) expect(parseSeatNumber(v)).toBeNull();
  });
});
