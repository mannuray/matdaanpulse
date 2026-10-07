import { allianceOf } from './election';
import { samePerson } from './match';
import { heavyweightsOf, switcherOf } from './notes';
import { share } from './rank';
import { carry, classOver, historyOf, incumbencyOf, makeCtx, seatOf, type Ctx } from './seat';
import { INDEPENDENT, NOTA, SCHEMA_VERSION, type AnalysisInput, type Baseline, type SeatBaseline, type SeatIn } from './types';

function prevOf(ctx: Ctx, seat: SeatIn): SeatBaseline['prev'] {
  const prevE = ctx.input.history[ctx.input.history.length - 1];
  const rk = prevE ? seatOf(ctx, prevE, seat.const_no) : undefined;
  const w = rk?.winner;
  if (!prevE || !rk || !w) return null;
  let shares: Record<string, number> | null = null;
  if (rk.total > 0) {
    const votes = new Map<string, number>();
    for (const c of rk.ranked) if (c.party_id && c.party_id !== INDEPENDENT) { const k = carry(ctx, c.party_id, prevE); votes.set(k, (votes.get(k) ?? 0) + c.votes); }
    shares = Object.fromEntries([...votes].map(([k, v]) => [k, share(v, rk.total)!]));
  }
  return {
    year: prevE.year, date: prevE.date, party_raw: w.party_id, holder: w.party_id ? carry(ctx, w.party_id, prevE) : null,
    alliance: w.party_id ? allianceOf(prevE, w.party_id) : null, candidate: w.name, person_id: w.person_id,
    margin: rk.margin, margin_pct: rk.margin != null ? share(rk.margin, rk.total) : null, shares, turnout: rk.seat.turnout,
  };
}

function marginsPct(ctx: Ctx, constNo: number): number[] {
  return ctx.input.history.map(e => seatOf(ctx, e, constNo)).filter(r => !!r && r.margin != null && r.total > 0).map(r => (r!.margin! / r!.total) * 100);
}

/** What is known about each seat of `input.current` before a vote is counted (spec §5.1). Pure. */
export function baselineOf(input: AnalysisInput): Baseline {
  const ctx = makeCtx(input);
  const { history, current } = input;
  const prevE = history[history.length - 1];
  const seats = current.seats.map((seat): SeatBaseline => {
    const prev = prevOf(ctx, seat);
    const inc = incumbencyOf(ctx, prevE, prevE ? seatOf(ctx, prevE, seat.const_no) : undefined, seat);
    const cands = seat.candidates.filter(c => c.party_id !== NOTA);
    const prk = prevE ? seatOf(ctx, prevE, seat.const_no) : undefined;
    const rematch = prk?.winner && prk.runnerUp && cands.some(c => samePerson(c, prk.winner!)) && cands.some(c => samePerson(c, prk.runnerUp!))
      ? [prk.winner.name, prk.runnerUp.name] as [string, string] : null;
    const m = marginsPct(ctx, seat.const_no).slice(-3);
    let sitting: SeatBaseline['sitting'] = null;
    if (inc) { const { won: _won, ...rest } = inc; sitting = rest; }
    return {
      const_id: seat.const_id, const_no: seat.const_no, prev,
      class_before: history.length ? classOver(ctx, history, seat.const_no) : null,
      sitting, rematch,
      switchers: cands.map(c => switcherOf(ctx, c, seat.const_no)).filter((n): n is NonNullable<typeof n> => !!n),
      heavyweights: heavyweightsOf(ctx, cands),
      close_last: prev?.margin_pct != null && prev.margin_pct < 3,
      narrowing_last: m.length === 3 && m[0] > m[1] && m[1] > m[2],
      electors: seat.electors,
      history: historyOf(ctx, history, seat.const_no),
    };
  });
  return { schema_version: SCHEMA_VERSION, election_id: current.id, date: current.date, state_id: input.stateId, lineage: input.lineage, alliances: current.alliances, seats };
}
