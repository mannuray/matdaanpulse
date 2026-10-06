/**
 * The party comparison rule (spec docs/superpowers/specs/2026-10-06-party-model-design.md §4). The same file lives in
 * backend/src/common/comparable-parties.ts and frontend/src/model/derive/comparableParties.ts; both are tested against
 * docs/party-lineage-cases.json. Pure: no I/O.
 *
 * - rename / merger → the same party for comparison;
 * - split → the ECI-recognised successor carries the old party's history; another faction holding an old-party seat is
 *   a `split` (not a flip); a seat it takes from any other party is a normal flip;
 * - only events dated after the earlier election and on or before the later one apply, and a state-scoped event only in
 *   its state.
 */

export interface LineageEventLike {
  party_id: string;
  predecessor_id: string;
  kind: 'rename' | 'merger' | 'split' | string;
  effective_date: string;
  state_id: number | null;
  is_successor: boolean;
}
export interface CompareContext { fromDate: string; toDate: string; stateId: number | null }
export type PartyRelation = 'same' | 'split' | 'different';

const inState = (e: LineageEventLike, stateId: number | null) => e.state_id == null || e.state_id === stateId;
const between = (e: LineageEventLike, from: string, to: string) => e.effective_date > from && e.effective_date <= to;

/** The parties an earlier party became by the later date, in order (the first is the party itself). */
function chain(events: LineageEventLike[], partyId: string, from: string, to: string, stateId: number | null): string[] {
  const seen = [partyId];
  let cur = partyId;
  for (;;) {
    const next = events
      .filter(e => e.predecessor_id === cur && e.is_successor && between(e, from, to) && inState(e, stateId))
      .sort((a, b) => a.effective_date.localeCompare(b.effective_date))[0];
    if (!next) return seen;
    if (seen.includes(next.party_id)) throw new Error(`lineage cycle at ${next.party_id}`);
    seen.push(next.party_id);
    cur = next.party_id;
  }
}

/** What an earlier party counts as by a later election (renames, mergers and a split's successor followed). */
export function carryForward(events: LineageEventLike[], partyId: string, fromDate: string, toDate: string, stateId: number | null): string {
  const c = chain(events, partyId, fromDate, toDate, stateId);
  return c[c.length - 1];
}

/** How a seat's previous party relates to its current one: the same party, a split faction, or a different party (flip). */
export function relation(events: LineageEventLike[], prevPartyId: string, curPartyId: string, ctx: CompareContext): PartyRelation {
  const c = chain(events, prevPartyId, ctx.fromDate, ctx.toDate, ctx.stateId);
  if (c[c.length - 1] === curPartyId) return 'same';
  const faction = events.some(e => e.party_id === curPartyId && e.kind === 'split' && !e.is_successor
    && c.includes(e.predecessor_id) && between(e, ctx.fromDate, ctx.toDate) && inState(e, ctx.stateId));
  return faction ? 'split' : 'different';
}

/**
 * The family a party belongs to on a date: the party it split from (root) and every faction of that split. The root is a
 * member while it still exists under its own id (no successor row: it kept its name, e.g. Shiv Sena).
 */
export function familyOf(events: LineageEventLike[], partyId: string, date: string, stateId: number | null): { root: string; members: string[] } {
  const applies = (e: LineageEventLike) => e.kind === 'split' && e.effective_date <= date && inState(e, stateId);
  const own = events.find(e => e.party_id === partyId && applies(e));
  const root = own ? own.predecessor_id : partyId;
  const splits = events.filter(e => e.predecessor_id === root && applies(e));
  if (!splits.length) return { root, members: [root] };
  const members = splits.map(e => e.party_id);
  if (!splits.some(e => e.is_successor)) members.unshift(root);
  return { root, members };
}
