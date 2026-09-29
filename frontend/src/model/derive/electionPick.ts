import type { Election } from '../types';

/**
 * Most recent election, preferring Live/Finalized (highest year first) and only
 * falling back to Upcoming elections when nothing else exists.
 */
export function pickLatestElection(elections: Election[], type?: 'LS' | 'VS'): Election | null {
  const pool = type ? elections.filter(e => e.type === type) : elections;
  const newest = (list: Election[]) => list.reduce<Election | null>((best, e) => (!best || e.year > best.year ? e : best), null);
  return newest(pool.filter(e => e.status !== 'Upcoming')) ?? newest(pool);
}
