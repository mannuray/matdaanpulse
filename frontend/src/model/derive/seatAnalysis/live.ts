import { allianceOf } from './election';
import { relation } from './lineage';
import { samePerson } from './match';
import { rank, r1, share } from './rank';
import {
  INDEPENDENT, type Baseline, type Call, type CandidateIn, type FlowRow, type LiveTally, type Momentum, type Outcome,
  type Placed, type SeatBaseline, type SeatLive, type SeatLiveIn, type SittingStatus, type Upset,
} from './types';

/** Provisional (tuned on synthetic simulation rounds, not real mid-count data): lead ÷ remaining votes. */
export const CALL_THRESHOLDS = { tooClose: 0.05, likely: 0.2 };
/** Provisional: momentum over the last `window` trail points. */
export const MOMENTUM = { window: 3, minFrac: 0.1, minVotes: 200, comebackFrac: 0.05 };

const placed = (c: CandidateIn | null, total: number): Placed | null =>
  c ? { name: c.name, person_id: c.person_id, party_id: c.party_id, votes: c.votes, share: share(c.votes, total) } : null;

function outcomeOf(b: Baseline, base: SeatBaseline | undefined, w: CandidateIn): Outcome {
  const p = base?.prev;
  if (!p) return { kind: 'new', from: null, from_raw: null };
  if (p.party_raw === INDEPENDENT || w.party_id === INDEPENDENT) {
    const same = p.party_raw === w.party_id && samePerson({ person_id: p.person_id, name: p.candidate }, w);
    return { kind: same ? 'retained' : 'gained', from: p.holder, from_raw: p.party_raw };
  }
  const rel = relation(b.lineage, p.party_raw ?? '', w.party_id ?? '', { fromDate: p.date, toDate: b.date, stateId: b.state_id });
  return { kind: rel === 'same' ? 'retained' : rel === 'split' ? 'split' : 'gained', from: p.holder, from_raw: p.party_raw };
}

function swingOf(base: SeatBaseline | undefined, rk: ReturnType<typeof rank>): SeatLive['swing'] {
  const p = base?.prev;
  if (!p) return null;
  const sw = (party: string | null) => {
    if (!party || party === INDEPENDENT || !p.shares || rk.total <= 0) return null;
    const now = r1((rk.ranked.filter(c => c.party_id === party).reduce((s, c) => s + c.votes, 0) / rk.total) * 100);
    return r1(now - (p.shares[party] ?? 0));
  };
  return { winner_party: sw(rk.winner!.party_id), prev_holder: sw(p.holder) };
}

function remainingOf(counted: number, round: SeatLiveIn['round'], base: SeatBaseline | undefined): number | null {
  if (round && round.current > 0 && round.total >= round.current) return Math.round((counted / round.current) * (round.total - round.current));
  if (base?.electors && base.prev?.turnout) return Math.max(0, Math.round((base.electors * base.prev.turnout) / 100) - counted);
  return null;
}

function callOf(rk: ReturnType<typeof rank>, counted: number, remaining: number | null): Call {
  if (rk.winner?.status === 'WON') return 'declared';
  if (counted <= 0) return 'not_started';
  // Votes but no leader: an exact tie (ECI marks both TRAILING) — as close as a seat can be.
  if (!rk.winner) return 'too_close';
  // No estimate, or one that ran out before the seat is declared (all rounds in, turnout above last time's): unknown.
  if (remaining == null || remaining <= 0) return 'counting';
  const f = (rk.margin ?? 0) / remaining;
  return f < CALL_THRESHOLDS.tooClose ? 'too_close' : f < CALL_THRESHOLDS.likely ? 'likely' : 'safe';
}

function momentumOf(trail: SeatLiveIn['trail']): Momentum | null {
  const pts = trail?.points.slice(-MOMENTUM.window) ?? [];
  if (pts.length < 2) return null;
  if (new Set(pts.map(p => p.lp)).size > 1) return 'switched';
  const first = pts[0].m ?? 0, last = pts[pts.length - 1].m ?? 0;
  const thr = Math.max(MOMENTUM.minFrac * first, MOMENTUM.minVotes);
  return last - first <= -thr ? 'narrowing' : last - first >= thr ? 'widening' : 'stable';
}

function comebackOf(trail: SeatLiveIn['trail'], leaderParty: string | null): boolean {
  // The whole timeline when the snapshot has it; else only the ≤6 points carried.
  if (trail && trail.md !== undefined) return (trail.md ?? 0) > MOMENTUM.comebackFrac;
  return !!trail?.points.some(p => p.lp !== leaderParty && p.v > 0 && (p.m ?? 0) / p.v > MOMENTUM.comebackFrac);
}

function sittingOf(base: SeatBaseline | undefined, byId: Map<string, ReturnType<typeof rank>>): SittingStatus | null {
  const s = base?.sitting;
  if (!s) return null;
  if (!s.recontested || !s.const_id) return 'not_contesting';
  const rk = byId.get(s.const_id);
  if (!rk) return null;
  const counted = rk.total;
  const me = rk.ranked.find(c => samePerson(c, s));
  if (!me) return null;
  if (rk.winner === me) return rk.winner.status === 'WON' ? 'won' : 'leading';
  if (rk.winner?.status === 'WON') return 'lost';
  return counted > 0 && rk.winner ? 'trailing' : 'not_started';
}

/** Live state of every seat from the baseline and the current results (spec §5.3). Pure; same rules as analyse(). */
export function analyseLive(b: Baseline, seats: SeatLiveIn[]): { seats: SeatLive[]; tally: LiveTally } {
  const bases = new Map(b.seats.map(s => [s.const_id, s]));
  const byId = new Map(seats.map(s => [s.const_id, rank({ const_id: s.const_id, const_no: 0, reserved: 'GEN', region_id: null, turnout: null, electors: null, candidates: s.candidates })]));
  const out = seats.map((s): SeatLive => {
    const base = bases.get(s.const_id);
    const rk = byId.get(s.const_id)!;
    const counted = rk.total;
    const remaining = remainingOf(counted, s.round, base);
    const call = callOf(rk, counted, remaining);
    // A winner declared unopposed has 0 votes but is still the winner.
    const w = counted > 0 || rk.winner?.status === 'WON' ? rk.winner : null;
    const sitting = sittingOf(base, byId);
    const upsets: Upset[] = [];
    if (w && base?.class_before?.kind === 'stronghold' && w.party_id !== base.class_before.holder) upsets.push('stronghold_trailing');
    if (w && base?.heavyweights.some(h => !samePerson({ person_id: null, name: h.name }, w))) upsets.push('heavyweight_trailing');
    if (w && base?.sitting?.const_id === s.const_id && (sitting === 'trailing' || sitting === 'lost')) upsets.push('sitting_trailing');
    return {
      const_id: s.const_id, leader: placed(w, counted), runner_up: w ? placed(rk.runnerUp, counted) : null, margin: w ? rk.margin : null,
      provisional: w?.status === 'LEADING', votes_counted: counted, remaining,
      outcome: w ? outcomeOf(b, base, w) : null, swing: w ? swingOf(base, rk) : null,
      call, momentum: momentumOf(s.trail), comeback: w ? comebackOf(s.trail, w.party_id) : false, lead_changes: s.trail?.lc ?? 0,
      sitting, upsets,
    };
  });
  return { seats: out, tally: tallyOf(b, bases, out) };
}

function tallyOf(b: Baseline, bases: Map<string, SeatBaseline>, seats: SeatLive[]): LiveTally {
  const rows = new Map<string, LiveTally['parties'][number]>();
  const row = (p: string) => rows.get(p) ?? rows.set(p, { party_id: p, won: 0, leading: 0, held: 0, gained: 0, lost: 0, split_gained: 0, split_lost: 0 }).get(p)!;
  const flow = new Map<string, FlowRow>(), moves = new Map<string, number>();
  const cur = { alliances: b.alliances };
  for (const s of seats) {
    const to = s.leader?.party_id;
    if (!to) continue;
    if (s.provisional) row(to).leading++; else row(to).won++;
    const o = s.outcome, from = o?.from;
    if (!o || o.kind === 'new' || !from) continue;
    if (o.kind === 'retained') row(to).held++;
    else if (o.kind === 'gained') { row(to).gained++; row(from).lost++; }
    else { row(to).split_gained++; row(from).split_lost++; }
    const split = o.kind === 'split', k = `${from}>${to}>${split}`;
    const f = flow.get(k) ?? { from, to, seats: 0, split }; f.seats++; flow.set(k, f);
    const pa = bases.get(s.const_id)?.prev?.alliance;
    if (pa && b.alliances.length && b.prev_has_alliances) { const ta = allianceOf(cur, to); if (pa !== ta) moves.set(`${pa}>${ta}`, (moves.get(`${pa}>${ta}`) ?? 0) + 1); }
  }
  return {
    parties: [...rows.values()].sort((a, c) => c.won + c.leading - (a.won + a.leading) || a.party_id.localeCompare(c.party_id)),
    flow: [...flow.values()].sort((a, c) => c.seats - a.seats),
    alliance_moves: [...moves].map(([k, n]) => { const [from, to] = k.split('>'); return { from, to, seats: n }; }).sort((a, c) => c.seats - a.seats),
  };
}
