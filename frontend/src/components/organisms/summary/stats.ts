import type { Region } from './types';

/** Seats whose result is declared (status WON). */
export function countDeclared(regions: Pick<Region, 'status'>[]): number {
  let n = 0;
  for (const r of regions) if (r.status === 'WON') n++;
  return n;
}

/** Sorted margins of seats that have a leader (WON or LEADING). */
export function leaderMargins(regions: Pick<Region, 'status' | 'margin'>[]): number[] {
  return regions
    .filter(r => (r.status === 'WON' || r.status === 'LEADING') && r.margin != null)
    .map(r => r.margin as number)
    .sort((a, b) => a - b);
}

export function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}
