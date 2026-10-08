import { carryForward } from './comparableParties';
import type { LineageEvent, PartyRecord, PartyRecordElection } from '../types';

/**
 * The party page's numbers from GET /parties/:id/record (spec docs/superpowers/specs/2026-10-08-party-page-design.md
 * §3–§4). Comparisons stay in one state; seats compare only on the same boundaries (delimitation), vote share always;
 * earlier totals include parties that merged into this one (lineage, comparableParties).
 */
export interface Delta { seats: number | null; share: number; vsLabel: string | null }
export interface Headline { won: number; seats: number; statesWon: number; statesContested: number; governs: number | null; largest: number }
export type RecordLine = { kind: 'election'; row: PartyRecordElection; delta: Delta | null }
  | { kind: 'event'; event: LineageEvent } | { kind: 'redraw'; delimitation: string | null; year: number };

/** Earlier elections in the same state, newest first. */
const older = (rows: PartyRecordElection[], row: PartyRecordElection) =>
  rows.filter(r => r.state_id === row.state_id && r.date < row.date).sort((a, b) => b.date.localeCompare(a.date));

/** The previous election in the same state on the same boundaries, or null (none, or a redraw in between). */
export function previousComparable(rows: PartyRecordElection[], row: PartyRecordElection): PartyRecordElection | null {
  const prev = older(rows, row)[0];
  return prev && prev.delimitation != null && prev.delimitation === row.delimitation ? prev : null;
}

/** Change since the previous election in the state; seats null across a redraw; null with no earlier election. */
export function deltaOf(partyId: string, rows: PartyRecordElection[], row: PartyRecordElection, events: LineageEvent[], nameOf: (id: string) => string): Delta | null {
  const prev = older(rows, row)[0];
  if (!prev) return null;
  const merged = prev.family.filter(f => carryForward(events, f.party_id, prev.date, row.date, row.state_id) === partyId);
  const prevWon = prev.won + merged.reduce((s, f) => s + f.won, 0);
  const prevShare = prev.share + merged.reduce((s, f) => s + f.share, 0);
  const sameBoundaries = prev.delimitation != null && prev.delimitation === row.delimitation;
  return {
    seats: sameBoundaries ? row.won - prevWon : null,
    share: row.share - prevShare,
    vsLabel: merged.length ? `${[partyId, ...merged.map(f => f.party_id)].map(nameOf).join(' + ')} ${prev.year}` : null,
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

/** The state's record, newest first, with lineage events and boundary redraws between the elections they fall between. */
export function recordLines(partyId: string, rec: PartyRecord, stateId: number, nameOf: (id: string) => string): RecordLine[] {
  const rows = rec.elections.filter(r => r.state_id === stateId);
  const out: RecordLine[] = [];
  rows.forEach((row, i) => {
    out.push({ kind: 'election', row, delta: deltaOf(partyId, rows, row, rec.lineage, nameOf) });
    const prev = rows[i + 1];
    if (!prev) return;
    rec.lineage.filter(ev => (ev.state_id == null || ev.state_id === stateId) && ev.effective_date > prev.date && ev.effective_date <= row.date)
      .reverse().forEach(event => out.push({ kind: 'event', event }));
    if (prev.delimitation !== row.delimitation) out.push({ kind: 'redraw', delimitation: row.delimitation, year: row.year });
  });
  return out;
}
