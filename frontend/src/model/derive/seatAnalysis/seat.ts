import { carryForward, relation } from './lineage';
import { findPerson, normName, samePerson } from './match';
import { rank, share, r1, type Ranked } from './rank';
import {
  INDEPENDENT, SCHEMA_VERSION, type AnalysisInput, type CandidateIn, type ElectionIn, type HistoryEntry, type Incumbency,
  type Outcome, type Placed, type SeatAnalysis, type SeatClass, type SeatIn, type SeatType,
} from './types';

/** Everything a seat analysis needs: the input plus each election's seats ranked, by const_no. */
export interface Ctx {
  input: AnalysisInput;
  /** election id → const_no → ranked seat. */
  idx: Map<string, Map<number, Ranked>>;
}

export const seatOf = (ctx: Ctx, e: ElectionIn, constNo: number): Ranked | undefined => ctx.idx.get(e.id)?.get(constNo);
const win = (ctx: Ctx, from: ElectionIn) => ({ fromDate: from.date, toDate: ctx.input.current.date, stateId: ctx.input.stateId });

/** A party of election `from` as this election's id (IND stays IND). */
export function carry(ctx: Ctx, party: string, from: ElectionIn): string {
  if (party === INDEPENDENT) return party;
  return carryForward(ctx.input.lineage, party, from.date, ctx.input.current.date, ctx.input.stateId);
}

/** Holder identity for streaks: the carried party, or the person for an independent (two independents differ). */
function holderKey(ctx: Ctx, c: CandidateIn, from: ElectionIn): string {
  return c.party_id === INDEPENDENT ? `IND:${normName(c.name)}` : carry(ctx, c.party_id ?? '', from);
}

const placed = (c: CandidateIn | null, total: number): Placed | null =>
  c ? { name: c.name, person_id: c.person_id, party_id: c.party_id, votes: c.votes, share: share(c.votes, total) } : null;

/** Sum of the vote share in `rk` of every candidate whose party satisfies `keep`. */
function partyShare(rk: Ranked, keep: (party: string) => boolean): number | null {
  if (rk.total <= 0) return null;
  const v = rk.ranked.filter(c => c.party_id && keep(c.party_id)).reduce((s, c) => s + c.votes, 0);
  return r1((v / rk.total) * 100);
}

function outcomeOf(ctx: Ctx, prevE: ElectionIn | undefined, prev: Ranked | undefined, cur: Ranked): Outcome {
  const w = cur.winner!;
  if (!prevE || !prev?.winner) return { kind: 'new', from: null, from_raw: null };
  const p = prev.winner;
  const fromRaw = p.party_id;
  const from = fromRaw ? carry(ctx, fromRaw, prevE) : null;
  if (fromRaw === INDEPENDENT || w.party_id === INDEPENDENT) {
    const same = fromRaw === w.party_id && samePerson(p, w);
    return { kind: same ? 'retained' : 'gained', from, from_raw: fromRaw };
  }
  const rel = relation(ctx.input.lineage, fromRaw ?? '', w.party_id ?? '', win(ctx, prevE));
  return { kind: rel === 'same' ? 'retained' : rel === 'split' ? 'split' : 'gained', from, from_raw: fromRaw };
}

function swingOf(ctx: Ctx, prevE: ElectionIn | undefined, prev: Ranked | undefined, cur: Ranked) {
  if (!prevE || !prev?.winner) return null;
  const sw = (party: string | null) => {
    if (!party || party === INDEPENDENT) return null;
    const now = partyShare(cur, q => q === party);
    const before = partyShare(prev, q => carry(ctx, q, prevE) === party);
    return now == null || before == null ? null : r1(now - before);
  };
  const holder = prev.winner.party_id ? carry(ctx, prev.winner.party_id, prevE) : null;
  return { winner_party: sw(cur.winner!.party_id), prev_holder: sw(holder) };
}

function classOf(ctx: Ctx, elections: ElectionIn[], constNo: number): SeatClass | null {
  const runs = elections
    .map(e => ({ e, w: seatOf(ctx, e, constNo)?.winner ?? null }))
    .filter((x): x is { e: ElectionIn; w: CandidateIn } => x.w != null)
    .map(x => ({ year: x.e.year, key: holderKey(ctx, x.w, x.e) }));
  const last = runs[runs.length - 1];
  if (!last || last.year !== ctx.input.current.year) return null;
  const holder = seatOf(ctx, ctx.input.current, constNo)?.winner?.party_id ?? '';
  let streak = 0;
  for (let i = runs.length - 1; i >= 0 && runs[i].key === last.key; i--) streak++;
  const wins = runs.filter(r => r.key === last.key).length;
  const total = runs.length;
  const since = runs[runs.length - streak].year;
  const kind = total === 1 ? 'new' : wins === total && total >= 3 ? 'stronghold' : streak >= 2 ? 'loyal' : 'swing';
  return { kind, holder, streak, since, wins, total };
}

function incumbencyOf(ctx: Ctx, prevE: ElectionIn | undefined, prev: Ranked | undefined, seat: SeatIn): Incumbency | null {
  if (!prevE || !prev?.winner) return null;
  const w = prev.winner;
  const m = findPerson(w, ctx.input.current, seat.const_no);
  const base = { name: w.name, person_id: w.person_id, party: w.party_id };
  if (!m) return { ...base, match: null, recontested: false, const_id: null, same_seat: false, party_now: null, switched: false, followed_split: false, won: null };
  const now = m.cand.party_id;
  let switched = false, followed = false;
  if (w.party_id === INDEPENDENT || now === INDEPENDENT) switched = w.party_id !== now;
  else {
    const rel = relation(ctx.input.lineage, w.party_id ?? '', now ?? '', win(ctx, prevE));
    switched = rel === 'different';
    followed = rel === 'split';
  }
  const there = seatOf(ctx, ctx.input.current, m.seat.const_no);
  return {
    ...base, match: m.match, recontested: true, const_id: m.seat.const_id, same_seat: m.seat.const_no === seat.const_no,
    party_now: now, switched, followed_split: followed, won: there?.winner ? there.winner === m.cand : null,
  };
}

function historyOf(ctx: Ctx, elections: ElectionIn[], constNo: number): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const e of elections) {
    const rk = seatOf(ctx, e, constNo);
    const w = rk?.winner;
    if (!rk || !w) continue;
    out.push({
      year: e.year, party: w.party_id, family: w.party_id ? carry(ctx, w.party_id, e) : null, candidate: w.name,
      person_id: w.person_id, margin: rk.margin, vote_share: share(w.votes, rk.total),
      runner_up: rk.runnerUp?.name ?? null, runner_up_party: rk.runnerUp?.party_id ?? null,
    });
  }
  return out;
}

/** Today's definition: three or more candidates at 10%+ → three-way (third ≥ 15%) or multi-cornered; else two-way. */
function seatTypeOf(rk: Ranked): SeatType | null {
  if (rk.ranked.length < 2 || rk.total <= 0) return null;
  const shares = rk.ranked.map(c => (c.votes / rk.total) * 100);
  if (shares.filter(s => s >= 10).length >= 3) return (shares[2] ?? 0) >= 15 ? 'three-way' : 'multi-cornered';
  return 'two-way';
}

export function analyseSeat(ctx: Ctx, seat: SeatIn): SeatAnalysis {
  const { current, history } = ctx.input;
  const cur = seatOf(ctx, current, seat.const_no) ?? rank(seat);
  const prevE = history[history.length - 1];
  const prev = prevE ? seatOf(ctx, prevE, seat.const_no) : undefined;
  const elections = [...history, current];
  const w = cur.winner;
  return {
    schema_version: SCHEMA_VERSION,
    const_id: seat.const_id,
    const_no: seat.const_no,
    winner: placed(w, cur.total),
    runner_up: placed(cur.runnerUp, cur.total),
    margin: cur.margin,
    margin_pct: cur.margin != null ? share(cur.margin, cur.total) : null,
    total_votes: cur.total,
    provisional: w?.status === 'LEADING',
    outcome: w ? outcomeOf(ctx, prevE, prev, cur) : null,
    swing: w ? swingOf(ctx, prevE, prev, cur) : null,
    class: w ? classOf(ctx, elections, seat.const_no) : null,
    incumbent: incumbencyOf(ctx, prevE, prev, seat),
    history: historyOf(ctx, elections, seat.const_no),
    seat_type: seatTypeOf(cur),
    notes: [],
  };
}
