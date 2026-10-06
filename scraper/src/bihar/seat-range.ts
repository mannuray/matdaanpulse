/**
 * A report that covers more seats than the state has today (Andhra's 2009/2014 reports cover the undivided state's 294
 * seats; today's Andhra is seats 120-294): keep the range and renumber it (new = old − offset).
 */
import type { RawElection } from './types';

export interface SeatRange { from: number; to: number; offset: number }

export function sliceSeats(raw: RawElection, r: SeatRange): RawElection {
  const keep = (n: number) => n >= r.from && n <= r.to;
  return {
    ...raw,
    seats: raw.seats.filter(s => keep(s.constNo)).map(s => ({ ...s, constNo: s.constNo - r.offset })),
    summaries: raw.summaries.filter(s => keep(s.constNo)).map(s => ({ ...s, constNo: s.constNo - r.offset })),
  };
}
