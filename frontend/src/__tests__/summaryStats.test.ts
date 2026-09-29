import { describe, it, expect } from 'vitest';
import { countDeclared, leaderMargins, median } from '../components/organisms/summary/stats';

const regions = [
  { status: 'WON', margin: 5000 },
  { status: 'LEADING', margin: 100 },
  { status: 'PENDING', margin: undefined },
  { status: 'WON', margin: 20000 },
];

describe('summary stats', () => {
  it('counts only WON seats as declared', () => {
    expect(countDeclared(regions)).toBe(2);
    expect(countDeclared([{ status: 'PENDING' }])).toBe(0);
  });

  it('computes margins only over seats with a leader', () => {
    expect(leaderMargins(regions)).toEqual([100, 5000, 20000]);
  });

  it('median handles odd, even and empty inputs', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBe(0);
  });
});
