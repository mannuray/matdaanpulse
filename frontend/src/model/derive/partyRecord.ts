import { carryForward } from './comparableParties';
import type { LineageEvent, PartyRecord, PartyRecordElection, PartyRecordFamilyElection, PartyRecordStateElection } from '../types';

/**
 * The party page's numbers from GET /parties/:id/record (spec docs/superpowers/specs/2026-10-08-party-page-design.md
 * §3–§4). Comparisons stay in one state; seats compare only on the same boundaries (delimitation), vote share always;
 * earlier totals include parties that merged into this one (lineage, comparableParties).
 */
/** `notContested`: the state's previous election, which neither the party nor a predecessor contested (no change shown). */
export interface Delta { seats: number | null; share: number | null; vsLabel: string | null; notContested?: number }
export interface Headline { won: number; seats: number; statesWon: number; statesContested: number; governs: number | null; largest: number }
export type RecordLine = { kind: 'election'; row: PartyRecordElection; delta: Delta | null }
  | { kind: 'event'; event: LineageEvent } | { kind: 'redraw'; delimitation: string | null; year: number };

/** Earlier elections in the same state, newest first. */
const older = (rows: PartyRecordElection[], row: PartyRecordElection) =>
  rows.filter(r => r.state_id === row.state_id && r.date < row.date).sort((a, b) => b.date.localeCompare(a.date));

/** The state's election just before `row` (from the state's election list), or undefined. */
function statePrevious(stateEls: PartyRecordStateElection[], row: PartyRecordElection): PartyRecordStateElection | undefined {
  return stateEls.filter(e => e.state_id === row.state_id && e.date < row.date).sort((a, b) => b.date.localeCompare(a.date))[0];
}

/**
 * The party's row at the previous election in the state on the same boundaries, or null (none, a redraw in between, or
 * it did not contest). With `stateEls`, "previous" is the state's previous election; without, the party's last contest.
 */
export function previousComparable(rows: PartyRecordElection[], row: PartyRecordElection, stateEls: PartyRecordStateElection[] = []): PartyRecordElection | null {
  const sp = stateEls.length ? statePrevious(stateEls, row) : undefined;
  const prev = stateEls.length ? (sp ? rows.find(r => r.election_id === sp.election_id) : undefined) : older(rows, row)[0];
  return prev && prev.delimitation != null && prev.delimitation === row.delimitation ? prev : null;
}

/**
 * Whether the state's previous election (as the stored analysis compares), contested by the party or not, was on the
 * same boundaries as `row`: false with a redraw in between or no earlier election. Without the state's election list,
 * falls back to the party's previous comparable contest.
 */
export function statePreviousSameBoundaries(rows: PartyRecordElection[], row: PartyRecordElection, stateEls: PartyRecordStateElection[] | undefined): boolean {
  if (!stateEls) return !!previousComparable(rows, row);
  const sp = statePrevious(stateEls, row);
  return !!sp && sp.delimitation != null && sp.delimitation === row.delimitation;
}

/**
 * Change since the previous election in the state: the party's own earlier contest plus parties that became it
 * (mergers, a successor's predecessor), or, before its first contest, its predecessors' earlier total (`familyOnly`).
 * Seats null across a redraw; null with nothing earlier.
 */
export function deltaOf(partyId: string, rows: PartyRecordElection[], row: PartyRecordElection, events: LineageEvent[], nameOf: (id: string) => string,
  familyOnly: PartyRecordFamilyElection[] = [], stateEls: PartyRecordStateElection[] = []): Delta | null {
  let own: PartyRecordElection | undefined;
  let fam: PartyRecordFamilyElection | undefined;
  if (stateEls.length) {
    // The state's previous election: the party's row there, else its predecessors', else "not contested".
    const sp = statePrevious(stateEls, row);
    if (!sp) return null;
    own = rows.find(r => r.election_id === sp.election_id);
    fam = own ? undefined : familyOnly.find(f => f.election_id === sp.election_id);
    if (!own && !fam) return { seats: null, share: null, vsLabel: null, notContested: sp.year };
  } else {
    own = older(rows, row)[0];
    const f = familyOnly.filter(x => x.state_id === row.state_id && x.date < row.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (f && (!own || f.date > own.date)) { fam = f; own = undefined; }
  }
  const prev = own ?? fam;
  if (!prev) return null;
  const merged = prev.family.filter(f => carryForward(events, f.party_id, prev.date, row.date, row.state_id) === partyId);
  if (!own && !merged.length) return stateEls.length ? { seats: null, share: null, vsLabel: null, notContested: prev.year } : null;
  const prevWon = (own ? own.won : 0) + merged.reduce((s, f) => s + f.won, 0);
  const prevShare = (own ? own.share : 0) + merged.reduce((s, f) => s + f.share, 0);
  const sameBoundaries = prev.delimitation != null && prev.delimitation === row.delimitation;
  return {
    seats: sameBoundaries ? row.won - prevWon : null,
    share: row.share - prevShare,
    vsLabel: merged.length ? `${[...(own ? [partyId] : []), ...merged.map(f => f.party_id)].map(nameOf).join(' + ')} ${prev.year}` : null,
  };
}

/** Each state's latest election (the record is newest first), by seats won. */
export function latestByState(rec: PartyRecord): PartyRecordElection[] {
  const seen = new Map<number, PartyRecordElection>();
  for (const r of rec.elections) if (!seen.has(r.state_id)) seen.set(r.state_id, r);
  return [...seen.values()].sort((a, b) => b.won - a.won || a.state_name.localeCompare(b.state_name));
}

/** National headline at each state's latest election; `governs` null when no government is recorded anywhere. */
export function headline(rec: PartyRecord): Headline {
  const latest = latestByState(rec);
  const recorded = latest.filter(r => r.formed_government != null);
  return {
    won: latest.reduce((s, r) => s + r.won, 0), seats: latest.reduce((s, r) => s + r.seats_total, 0),
    statesWon: latest.filter(r => r.won > 0).length, statesContested: latest.length,
    governs: recorded.length ? recorded.filter(r => r.formed_government).length : null,
    largest: latest.filter(r => r.largest).length,
  };
}

/** Seats won in one state, oldest → newest. */
export function sparkline(rec: PartyRecord, stateId: number): number[] {
  return rec.elections.filter(r => r.state_id === stateId).map(r => r.won).reverse();
}

/** The state's record, newest first, with this state's lineage events and boundary redraws between the elections they fall between. */
export function recordLines(partyId: string, rec: PartyRecord, stateId: number, nameOf: (id: string) => string): RecordLine[] {
  const rows = rec.elections.filter(r => r.state_id === stateId);
  // A national event (state_id null) belongs here only if the other party in it ran in this state.
  const ranHere = new Set(rows.flatMap(r => r.family.map(f => f.party_id)));
  const relevant = (ev: LineageEvent) => ev.state_id === stateId
    || (ev.state_id == null && ranHere.has(ev.party_id === partyId ? ev.predecessor_id : ev.party_id));
  const out: RecordLine[] = [];
  rows.forEach((row, i) => {
    out.push({ kind: 'election', row, delta: deltaOf(partyId, rows, row, rec.lineage, nameOf, rec.family_elections ?? [], rec.state_elections ?? []) });
    const prev = rows[i + 1];
    if (!prev) return;
    rec.lineage.filter(ev => relevant(ev) && ev.effective_date > prev.date && ev.effective_date <= row.date)
      .reverse().forEach(event => out.push({ kind: 'event', event }));
    if (prev.delimitation !== row.delimitation) out.push({ kind: 'redraw', delimitation: row.delimitation, year: row.year });
  });
  return out;
}

/** Independents and NOTA are not parties: no party page. */
const NOT_A_PARTY = new Set(['IND', 'NOTA']);

/** The party page link (with a state view when `stateCode` is given), or null for independents, NOTA or no party. */
export function partyPageHref(partyId: string | null | undefined, stateCode?: string | null): string | null {
  if (!partyId || NOT_A_PARTY.has(partyId.toUpperCase())) return null;
  return `/party/${encodeURIComponent(partyId)}${stateCode ? `?state=${encodeURIComponent(stateCode.toUpperCase())}` : ''}`;
}
