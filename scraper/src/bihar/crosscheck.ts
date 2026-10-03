import type { ElectionJson, RawElection } from './types';
import { STATES, type ElectionConfig } from './elections';
import { normName } from './names';

export interface CrossCheckException { year: number; key: string; reason: string }


export function crossCheck(e: RawElection, exceptions: CrossCheckException[]): string[] {
  const errs: string[] = [];
  const add = (key: string, msg: string) => errs.push(`${key} ${msg}`);
  const fullOf = (abbr: string) => (abbr === 'IND' ? 'Independent' : e.parties.find(p => p.abbr === abbr)?.name ?? abbr);
  const sameParty = (abbr: string, summaryParty: string) => summaryParty === abbr || normName(fullOf(abbr)) === normName(summaryParty);

  const summaries = new Map(e.summaries.map(s => [s.constNo, s]));
  for (const s of e.summaries) if (!e.seats.some(x => x.constNo === s.constNo)) add(`detailed-missing:${s.constNo}`, 'summary seat absent from Detailed Results');
  for (const seat of e.seats) {
    const m = summaries.get(seat.constNo);
    const k = (c: string) => `${c}:${seat.constNo}`;
    if (!m) { add(k('summary-missing'), 'seat absent from Constituency Data Summary'); continue; }
    if (seat.type && seat.type !== m.type) add(k('type'), `detailed ${seat.type} vs summary ${m.type}`);
    if (seat.electors !== m.electors) add(k('electors'), `detailed ${seat.electors} vs summary ${m.electors}`);
    if (seat.candidates.length !== m.contested) add(k('contested'), `detailed ${seat.candidates.length} vs summary ${m.contested}`);
    const valid = seat.candidates.reduce((a, c) => a + c.total, 0);
    if (valid !== m.totalValid) add(k('total-valid'), `detailed ${valid} vs summary ${m.totalValid}`);
    if ((seat.nota ?? null) !== (m.nota ?? null)) add(k('nota'), `detailed ${seat.nota} vs summary ${m.nota}`);
    if (valid + (seat.nota ?? 0) !== seat.totalVotes) add(k('turnout-row'), `candidates+NOTA ${valid + (seat.nota ?? 0)} vs TURNOUT row ${seat.totalVotes}`);
    const ranked = [...seat.candidates].sort((a, b) => b.total - a.total);
    const [w, r] = ranked;
    if (!w || !sameParty(w.party, m.winner.party) || w.total !== m.winner.votes) add(k('winner'), `detailed ${w?.party} ${w?.total} vs summary ${m.winner.party} ${m.winner.votes}`);
    if (!r || !sameParty(r.party, m.runnerUp.party) || r.total !== m.runnerUp.votes) add(k('runner-up'), `detailed ${r?.party} ${r?.total} vs summary ${m.runnerUp.party} ${m.runnerUp.votes}`);
    if (w && r && w.total - r.total !== m.margin) add(k('margin'), `detailed ${w.total - r.total} vs summary ${m.margin}`);
  }
  const ak = (a: string) => a.replace(/\s/g, '').toUpperCase();
  const perf = new Map<string, { abbr: string; contested: number; won: number; votes: number }>();
  for (const p of e.performance) {
    const t = perf.get(ak(p.abbr)) ?? { abbr: p.abbr, contested: 0, won: 0, votes: 0 };
    perf.set(ak(p.abbr), { abbr: p.abbr, contested: t.contested + p.contested, won: t.won + p.won, votes: t.votes + p.votes });
  }
  for (const p of perf.values()) {
    if (p.abbr === 'IND') continue; // independents are reported as one pseudo-party in some years; checked through seats
    const cands = e.seats.flatMap(s => s.candidates.filter(c => ak(c.party) === ak(p.abbr)));
    const won = e.seats.filter(s => ak([...s.candidates].sort((a, b) => b.total - a.total)[0]?.party ?? '') === ak(p.abbr)).length;
    const votes = cands.reduce((a, c) => a + c.total, 0);
    if (cands.length !== p.contested) add(`party-contested:${p.abbr}`, `detailed ${cands.length} vs performance ${p.contested}`);
    if (won !== p.won) add(`party-won:${p.abbr}`, `detailed ${won} vs performance ${p.won}`);
    if (votes !== p.votes) add(`party-votes:${p.abbr}`, `detailed ${votes} vs performance ${p.votes}`);
  }
  const skip = new Set(exceptions.filter(x => x.year === e.year).map(x => x.key));
  return errs.filter(x => !skip.has(x.split(' ')[0]));
}

/** The seat, reservation and poll-date expectations come from the election registry. */
export function validateElection(e: ElectionJson, cfg: ElectionConfig): string[] {
  const errs: string[] = [];
  const st = STATES[cfg.state];
  const seats = cfg.seats ?? st.seats;
  if (e.seats.length !== seats) errs.push(`seats: ${e.seats.length} seats, expected ${seats}`);
  const count = (t: string) => e.seats.filter(s => s.type === t).length;
  if (count('SC') !== st.reserved.sc || count('ST') !== st.reserved.st) errs.push(`reserved: SC ${count('SC')} / ST ${count('ST')}, expected ${st.reserved.sc} / ${st.reserved.st}`);
  const phases = new Set(e.seats.map(s => s.phase)).size;
  if (phases !== cfg.expectedPhases) errs.push(`phases: ${phases} distinct phases, expected ${cfg.expectedPhases}`);
  for (const s of e.seats) {
    const real = s.candidates.filter(c => c.partyId !== 'NOTA');
    const winners = s.candidates.filter(c => c.status === 'WON');
    if (winners.length !== 1 || winners[0].partyId === 'NOTA') errs.push(`winners:${s.constNo} ${winners.length} winners`);
    const top = [...real].sort((a, b) => b.votes - a.votes);
    if (top.length > 1 && top[0].votes === top[1].votes) errs.push(`tie:${s.constNo}`);
    if (winners[0] && top[0] && winners[0] !== top[0]) errs.push(`winner-not-top:${s.constNo}`);
    if (!(s.turnout > 0 && s.turnout <= 100)) errs.push(`turnout:${s.constNo} ${s.turnout}`);
    if (!s.candidates.every(c => Number.isInteger(c.votes) && c.votes >= 0)) errs.push(`votes:${s.constNo}`);
  }
  return errs;
}
