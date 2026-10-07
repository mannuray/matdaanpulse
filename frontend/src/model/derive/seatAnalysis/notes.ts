import { relation } from './lineage';
import { findPerson, samePerson, strictSamePerson } from './match';
import { seatOf, type Ctx } from './seat';
import { INDEPENDENT, NOTA, type CandidateIn, type ElectionIn, type HeavyweightReason, type SeatAnalysis, type SeatIn, type SeatNote } from './types';

const isParty = (p: string | null): p is string => !!p && p !== INDEPENDENT && p !== NOTA;

function spoiler(ctx: Ctx, rk: NonNullable<ReturnType<typeof seatOf>>): SeatNote | null {
  const { winner, margin, ranked } = rk;
  if (!winner || margin == null) return null;
  const { current, voteSplits } = ctx.input;
  for (const vs of voteSplits) {
    const hurt = current.alliances.find(a => a.id === vs.hurts);
    const cand = ranked.find(c => c !== winner && c.party_id === vs.spoiler);
    if (cand && hurt && !hurt.parties.includes(winner.party_id ?? '') && cand.votes > margin) {
      return { kind: 'spoiler', name: cand.name, party: cand.party_id, votes: cand.votes, margin, hurts: vs.hurts, ...(vs.label ? { label: vs.label } : {}) };
    }
  }
  const third = ranked[2];
  return third && third.votes > margin ? { kind: 'spoiler', name: third.name, party: third.party_id, votes: third.votes, margin } : null;
}

/** The previous candidacy of `c` (newest first: comparable history, then previousAny across a redraw). */
function lastCandidacy(ctx: Ctx, c: CandidateIn, constNo: number) {
  const { history, previousAny } = ctx.input;
  const list: ElectionIn[] = [...history].reverse();
  if (previousAny && !list.some(e => e.id === previousAny.id)) list.push(previousAny);
  for (const e of list) {
    const m = findPerson(c, e, constNo);
    if (m) return { e, m };
  }
  return null;
}

export function seatNotes(ctx: Ctx, seat: SeatIn, _a: SeatAnalysis): SeatNote[] {
  const rk = seatOf(ctx, ctx.input.current, seat.const_no);
  if (!rk?.winner) return [];
  const notes: SeatNote[] = [];
  const sp = spoiler(ctx, rk);
  if (sp) notes.push(sp);
  if (rk.margin != null && rk.nota > rk.margin) notes.push({ kind: 'nota', votes: rk.nota, margin: rk.margin });

  const { history } = ctx.input;
  const prevE = history[history.length - 1];
  const prev = prevE ? seatOf(ctx, prevE, seat.const_no) : undefined;
  const top = [rk.winner, rk.runnerUp].filter((c): c is CandidateIn => !!c);
  if (prev?.winner && prev.runnerUp && top.length === 2) {
    const was = [prev.winner, prev.runnerUp];
    if (top.every(c => was.some(w => samePerson(w, c)))) notes.push({ kind: 'rematch', names: [top[0].name, top[1].name] });
    const beaten = rk.ranked.find(c => c !== rk.winner && samePerson(c, prev.winner!));
    if (samePerson(rk.winner, prev.runnerUp) && beaten) notes.push({ kind: 'revenge', name: rk.winner.name, beat: beaten.name });
  }

  for (const c of top) {
    if (!isParty(c.party_id)) continue;
    const last = lastCandidacy(ctx, c, seat.const_no);
    const old = last?.m.cand.party_id ?? null;
    if (!last || !isParty(old)) continue;
    const rel = relation(ctx.input.lineage, old, c.party_id, { fromDate: last.e.date, toDate: ctx.input.current.date, stateId: ctx.input.stateId });
    if (rel === 'different') notes.push({ kind: 'switcher', name: c.name, from: old, to: c.party_id, year: last.e.year, match: last.m.match });
  }

  for (const c of rk.ranked) {
    const reasons: HeavyweightReason[] = [];
    for (const h of ctx.input.heavyweights) {
      const party = !h.party_id || !c.party_id || h.party_id === c.party_id || (h.person_id != null && h.person_id === c.person_id);
      if (party && strictSamePerson(h, c) && !reasons.includes(h.reason)) reasons.push(h.reason);
    }
    if (reasons.length) notes.push({ kind: 'heavyweight', name: c.name, party: c.party_id, reasons });
  }
  return notes;
}
