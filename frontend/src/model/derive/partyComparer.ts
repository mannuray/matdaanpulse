/**
 * Party comparisons between two elections of one state, keyed by election year: the lineage rule
 * (comparableParties.ts) bound to the state's events and counting dates. Model functions take an optional comparer and
 * default to RAW_COMPARER (plain id equality), so they work unchanged where no lineage is loaded. Pure.
 */
import { carryForward, relation, type LineageEventLike, type PartyRelation } from './comparableParties';

export interface PartyComparer {
  relation(prevParty: string, curParty: string, fromYear: number, toYear: number): PartyRelation;
  carry(party: string, fromYear: number, toYear: number): string;
}

export const RAW_COMPARER: PartyComparer = {
  relation: (a, b) => (a === b ? 'same' : 'different'),
  carry: p => p,
};

/** `dates`: election year → counting date (YYYY-MM-DD); a missing year uses 1 July of that year. */
export function makeComparer(events: LineageEventLike[], dates: Map<number, string>, stateId: number | null): PartyComparer {
  if (!events.length) return RAW_COMPARER;
  const d = (y: number) => dates.get(y) ?? `${y}-07-01`;
  return {
    relation: (a, b, from, to) => relation(events, a, b, { fromDate: d(from), toDate: d(to), stateId }),
    carry: (p, from, to) => carryForward(events, p, d(from), d(to), stateId),
  };
}
