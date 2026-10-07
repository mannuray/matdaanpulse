import { familyOf } from './lineage';
import { r1, type Ranked } from './rank';
import { carry, seatOf, type Ctx } from './seat';
import {
  ALLIANCE_ALIASES, INDEPENDENT, SCHEMA_VERSION, type AllianceChange, type BreakdownRow, type ElectionAnalysis, type ElectionIn,
  type FamilyRow, type FlowRow, type PartyRow, type SeatAnalysis,
} from './types';

const pct = (v: number, t: number) => (t > 0 ? r1((v / t) * 100) : 0);
const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

function ranks(ctx: Ctx, e: ElectionIn): Ranked[] {
  // Each indexed seat once (a stray duplicate const_no maps to the same ranked seat).
  return e.seats.map(s => seatOf(ctx, e, s.const_no)).filter((r, i): r is Ranked => !!r && r.seat.const_id === e.seats[i].const_id);
}

/** Seats won and votes per party (as `key` maps it) over an election. */
function tally(rs: Ranked[], key: (party: string) => string) {
  const won = new Map<string, number>(), votes = new Map<string, number>(), contested = new Map<string, number>();
  let total = 0;
  for (const r of rs) {
    total += r.total;
    for (const c of r.ranked) {
      if (!c.party_id) continue;
      const k = key(c.party_id);
      bump(votes, k, c.votes);
      bump(contested, k);
    }
    if (r.winner?.party_id) bump(won, key(r.winner.party_id));
  }
  return { won, votes, contested, total };
}

function parties(ctx: Ctx, seats: SeatAnalysis[]): { rows: PartyRow[]; total: number } {
  const { current, previousAny } = ctx.input;
  const now = tally(ranks(ctx, current), p => p);
  const before = previousAny ? tally(ranks(ctx, previousAny), p => carry(ctx, p, previousAny)) : null;
  const o = { held: new Map<string, number>(), gained: new Map<string, number>(), lost: new Map<string, number>(), sg: new Map<string, number>(), sl: new Map<string, number>() };
  for (const s of seats) {
    const to = s.winner?.party_id, from = s.outcome?.from;
    if (!to || !s.outcome || s.outcome.kind === 'new' || !from) continue;
    if (s.outcome.kind === 'retained') bump(o.held, to);
    else if (s.outcome.kind === 'gained') { bump(o.gained, to); bump(o.lost, from); }
    else { bump(o.sg, to); bump(o.sl, from); }
  }
  const ids = new Set([...now.contested.keys(), ...(before ? [...before.won.keys()] : [])]);
  const rows = [...ids].map((p): PartyRow => ({
    party_id: p, contested: now.contested.get(p) ?? 0, won: now.won.get(p) ?? 0, votes: now.votes.get(p) ?? 0,
    share: pct(now.votes.get(p) ?? 0, now.total),
    prev: before ? { won: before.won.get(p) ?? 0, share: pct(before.votes.get(p) ?? 0, before.total) } : null,
    held: o.held.get(p) ?? 0, gained: o.gained.get(p) ?? 0, lost: o.lost.get(p) ?? 0, split_gained: o.sg.get(p) ?? 0, split_lost: o.sl.get(p) ?? 0,
  }));
  rows.sort((a, b) => b.won - a.won || b.votes - a.votes || a.party_id.localeCompare(b.party_id));
  return { rows, total: now.total };
}

function families(ctx: Ctx, rows: PartyRow[], total: number): FamilyRow[] {
  const byRoot = new Map<string, FamilyRow>();
  for (const r of rows) {
    if (r.party_id === INDEPENDENT) continue;
    const f = familyOf(ctx.input.lineage, r.party_id, ctx.input.current.date, ctx.input.stateId);
    if (f.members.length < 2) continue;
    const row = byRoot.get(f.root) ?? { root: f.root, members: [...f.members].sort(), won: 0, share: 0 };
    row.won += r.won;
    row.share = r1(row.share + (total > 0 ? (r.votes / total) * 100 : 0));
    byRoot.set(f.root, row);
  }
  return [...byRoot.values()];
}

function flow(seats: SeatAnalysis[]): FlowRow[] {
  const m = new Map<string, FlowRow>();
  for (const s of seats) {
    const to = s.winner?.party_id, from = s.outcome?.from;
    if (!to || !from || !s.outcome || s.outcome.kind === 'new') continue;
    const split = s.outcome.kind === 'split';
    const k = `${from}>${to}>${split}`;
    const row = m.get(k) ?? { from, to, seats: 0, split };
    row.seats++;
    m.set(k, row);
  }
  return [...m.values()].sort((a, b) => b.seats - a.seats);
}

export const allianceOf = (e: Pick<ElectionIn, 'alliances'>, party: string | null) => {
  const a = party ? e.alliances.find(x => x.parties.includes(party)) : undefined;
  return a ? ALLIANCE_ALIASES[a.id] ?? a.id : 'OTHERS';
};

function allianceShares(ctx: Ctx, e: ElectionIn): Map<string, number> {
  const t = tally(ranks(ctx, e), p => allianceOf(e, p));
  return new Map([...t.votes].map(([k, v]) => [k, pct(v, t.total)]));
}

function alliance(ctx: Ctx, seats: SeatAnalysis[]): AllianceChange | null {
  const { current, history, previousAny } = ctx.input;
  const prevE = history[history.length - 1];
  if (!current.alliances.length || !prevE?.alliances.length) return null;
  const moves = new Map<string, number>(), within = new Map<string, number>();
  for (const s of seats) {
    const prev = seatOf(ctx, prevE, s.const_no)?.winner;
    if (!s.winner || !prev || !s.outcome || s.outcome.kind === 'new') continue;
    const from = allianceOf(prevE, prev.party_id), to = allianceOf(current, s.winner.party_id);
    if (from !== to) bump(moves, `${from}>${to}`);
    else if (s.outcome.kind !== 'retained') bump(within, to);
  }
  const now = allianceShares(ctx, current);
  const before = previousAny?.alliances.length ? allianceShares(ctx, previousAny) : null;
  return {
    moves: [...moves].map(([k, n]) => { const [from, to] = k.split('>'); return { from, to, seats: n }; }).sort((a, b) => b.seats - a.seats),
    within: [...within].map(([a, n]) => ({ alliance: a, seats: n })).sort((a, b) => b.seats - a.seats),
    shares: [...now].map(([a, v]) => ({ alliance: a, share: v, prev_share: before ? before.get(a) ?? 0 : null })).sort((a, b) => b.share - a.share),
  };
}

/** margin % per comparable election (this one last) for a seat. */
function margins(ctx: Ctx, constNo: number): number[] {
  return [...ctx.input.history, ctx.input.current]
    .map(e => seatOf(ctx, e, constNo))
    .filter((r): r is Ranked => !!r && r.margin != null && r.total > 0)
    .map(r => (r.margin! / r.total) * 100);
}

function bellwether(ctx: Ctx, s: SeatAnalysis): boolean {
  const all = [...ctx.input.history, ctx.input.current];
  if (all.length < 3) return false;
  return all.every(e => {
    const w = seatOf(ctx, e, s.const_no)?.winner;
    return !!w?.party_id && !!e.government?.length && e.government.includes(w.party_id);
  });
}

function breakdown(ctx: Ctx, groupOf: (r: Ranked) => string | null): BreakdownRow[] {
  const groups = new Map<string, Ranked[]>();
  for (const r of ranks(ctx, ctx.input.current)) {
    const g = groupOf(r);
    if (g != null) groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  return [...groups].map(([group, rs]) => {
    const t = tally(rs, p => p);
    const parties = [...t.votes.keys()]
      .map(p => ({ party_id: p, won: t.won.get(p) ?? 0, share: pct(t.votes.get(p) ?? 0, t.total) }))
      .filter(p => p.won > 0 || p.share >= 1)
      .sort((a, b) => b.won - a.won || b.share - a.share);
    return { group, seats: rs.length, parties };
  }).sort((a, b) => a.group.localeCompare(b.group));
}

function turnoutBand(ctx: Ctx, r: Ranked): string | null {
  const prevE = ctx.input.history[ctx.input.history.length - 1];
  const before = prevE ? seatOf(ctx, prevE, r.seat.const_no)?.seat.turnout : null;
  if (r.seat.turnout == null || before == null) return null;
  const d = r.seat.turnout - before;
  return d < -5 ? '<-5' : d < 0 ? '-5–0' : d < 5 ? '0–5' : '≥5';
}

export function analyseElection(ctx: Ctx, seats: SeatAnalysis[]): ElectionAnalysis {
  const { current, history, previousAny } = ctx.input;
  const { rows, total } = parties(ctx, seats);
  return {
    schema_version: SCHEMA_VERSION,
    election_id: current.id,
    prev_election_id: history[history.length - 1]?.id ?? null,
    prev_any_election_id: previousAny?.id ?? null,
    total_votes: total,
    parties: rows,
    families: families(ctx, rows, total),
    flow: flow(seats),
    alliance: alliance(ctx, seats),
    close_seats: seats.filter(s => s.margin_pct != null && s.margin_pct < 3).map(s => s.const_id),
    narrowing_seats: seats.filter(s => { const m = margins(ctx, s.const_no).slice(-3); return m.length === 3 && m[0] > m[1] && m[1] > m[2]; }).map(s => s.const_id),
    bellwethers: seats.filter(s => bellwether(ctx, s)).map(s => s.const_id),
    breakdowns: {
      reserved: breakdown(ctx, r => r.seat.reserved),
      region: breakdown(ctx, r => (r.seat.region_id != null ? String(r.seat.region_id) : null)),
      turnout: breakdown(ctx, r => turnoutBand(ctx, r)),
    },
  };
}
