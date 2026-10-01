import { describe, it, expect } from 'vitest';
import { assetsHelper, formatMargin, ordinal, parseSeatNumber, toOptionalNumber } from './numbers';

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

describe('assetsHelper', () => {
  it('shows the rupee value in Indian grouping plus crore or lakh', () => {
    expect(assetsHelper('24500000')).toBe('₹2,45,00,000 · ₹2.45 crore');
    expect(assetsHelper('₹ 2,45,00,000')).toBe('₹2,45,00,000 · ₹2.45 crore');
    expect(assetsHelper('8500000')).toBe('₹85,00,000 · ₹85 lakh');
    expect(assetsHelper('1234567')).toBe('₹12,34,567 · ₹12.35 lakh');
    expect(assetsHelper('10000000')).toBe('₹1,00,00,000 · ₹1.00 crore');
    expect(assetsHelper('99999')).toBe('₹99,999');
  });
  it('says nothing for an empty or non-numeric value', () => {
    expect(assetsHelper('')).toBeNull();
    expect(assetsHelper('Rs 2 Crore+')).toBeNull();
  });
});

describe('ordinal and formatMargin', () => {
  it('ordinal', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
  });
  it('formatMargin signs and groups the vote gap', () => {
    expect(formatMargin(12309)).toBe('+12,309');
    expect(formatMargin(-90652)).toBe('−90,652');
    expect(formatMargin(0)).toBe('0');
    expect(formatMargin(null)).toBe('—');
  });
});
