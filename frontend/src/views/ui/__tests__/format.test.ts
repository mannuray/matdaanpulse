import { describe, it, expect } from 'vitest';
import { formatRupees, formatIN } from '../format';

describe('formatRupees', () => {
  it('uses crore, lakh and plain rupees', () => {
    expect(formatRupees(48000000)).toBe('₹4.8 Cr');
    expect(formatRupees(3200000)).toBe('₹32 L');
    expect(formatRupees(8500)).toBe('₹8,500');
    expect(formatRupees(0)).toBe('₹0');
    expect(formatRupees(null)).toBeNull();
  });
});

describe('formatIN', () => {
  it('groups digits the Indian way', () => {
    expect(formatIN(2014532)).toBe('20,14,532');
  });
});
