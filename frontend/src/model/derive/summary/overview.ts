import { roundPct } from '../scoreboard';
import type { SeatResult } from '../../types/dashboard';
import { FALLBACK_COLOR, allianceByParty, bucketIndex, buckets, colorOf, int, ledSeats, marginRow, partyName, pct, signed } from './shared';
import type { SummaryContext, SummaryRow, SummarySection } from './types';

const LIST_LIMIT = 10;

/** OverviewSection.tsx:53-67 — reserved (SC/ST) seats per leading party ('IND' when none, as legacy). */
function reserved(ctx: SummaryContext): SummarySection | null {
  const map = new Map<string, { color: string; sc: number; st: number }>();
  for (const s of ctx.seats) {
    if (s.type !== 'SC' && s.type !== 'ST') continue;
    const pid = s.party || 'IND';
    const e = map.get(pid) ?? { color: s.party ? colorOf(ctx, s.party) : FALLBACK_COLOR, sc: 0, st: 0 };
    if (s.type === 'SC') e.sc++; else e.st++;
    map.set(pid, e);
  }
  if (map.size === 0) return null;
  const rows: SummaryRow[] = [...map.entries()]
    .sort((a, b) => (b[1].sc + b[1].st) - (a[1].sc + a[1].st))
    .map(([pid, e]) => ({
      id: `party:${pid}`, label: pid === 'IND' ? pid : partyName(ctx, pid), value: e.sc + e.st, valueFormat: 'int' as const,
      extra: [int(e.sc), int(e.st)], color: e.color, partyIds: [pid],
    }));
  return { id: 'reserved', titleKey: 'studio_sum_reserved', columnsKeys: ['studio_col_total', 'studio_col_sc', 'studio_col_st'], rows };
}

/** OverviewSection.tsx:153-199 — vote share vs seat share per alliance, plus the party view (top 10 by vote share). */
function voteVsSeats(ctx: SummaryContext, led: SeatResult[]): SummarySection | null {
  // Legacy only rendered this when the manifest defines alliances (standings.groups.length > 0).
  if (ctx.alliances.length === 0 || led.length === 0) return null;
  const total = led.length;
  const seatsOf = new Map<string, number>();
  led.forEach(s => seatsOf.set(s.party, (seatsOf.get(s.party) ?? 0) + 1));
  const vote = (id: string) => ctx.votePct.get(id) ?? 0;
  const mk = (id: string, label: string, color: string, seats: number, votePct: number, partyIds: string[]): SummaryRow => {
    const seatPct = (seats / total) * 100;
    return {
      id, label, value: seats, valueFormat: 'int', color, partyIds,
      extra: [pct(roundPct(seatPct)), pct(roundPct(votePct)), signed(roundPct(seatPct - votePct))],
      bar: { value: roundPct(seatPct), max: 100, color },
    };
  };
  const alliances = ctx.alliances.map(a => mk(
    `alliance:${a.id}`, a.name, a.color, a.parties.reduce((n, p) => n + (seatsOf.get(p) ?? 0), 0),
    a.parties.reduce((n, p) => n + vote(p), 0), a.parties,
  ));
  const inAlliance = allianceByParty(ctx.alliances);
  const othersSeats = led.filter(s => !inAlliance.has(s.party)).length;
  const othersVote = [...ctx.votePct.entries()].filter(([id]) => !inAlliance.has(id)).reduce((n, [, v]) => n + v, 0);
  const rows = alliances;
  if (othersSeats > 0 || othersVote > 0) {
    const r = mk('others', '', '#6b7280', othersSeats, othersVote, []);
    rows.push({ ...r, labelKey: 'others' });
  }
  rows.sort((a, b) => (b.extra![0].value ?? 0) - (a.extra![0].value ?? 0));

  const ids = new Set([...ctx.parties.map(p => p.id), ...ctx.votePct.keys()]);
  const partyRows = [...ids]
    .filter(id => (seatsOf.get(id) ?? 0) > 0 || vote(id) >= 1)
    .sort((a, b) => vote(b) - vote(a))
    .slice(0, LIST_LIMIT)
    .map(id => mk(`party:${id}`, partyName(ctx, id), colorOf(ctx, id), seatsOf.get(id) ?? 0, vote(id), [id]));
  return {
    id: 'vote_vs_seats', titleKey: 'studio_sum_vote_vs_seats',
    columnsKeys: ['studio_col_seats', 'studio_col_seat_pct', 'studio_col_vote_pct', 'studio_col_disparity'],
    rows: [...rows, ...partyRows],
  };
}

/** OverviewSection.tsx:254-276 — votes cast for an alliance's parties in seats its alliance did not win. */
function wasted(ctx: SummaryContext): SummarySection | null {
  const cc = ctx.constCandidates;
  if (!cc || cc.size === 0 || ctx.alliances.length === 0) return null;
  const al = allianceByParty(ctx.alliances);
  const totalVotes = new Map<string, number>();
  const wastedVotes = new Map<string, number>();
  for (const cands of cc.values()) {
    if (cands.length === 0) continue;
    const winner = al.get(cands[0].party_id);
    for (const c of cands) {
      const a = al.get(c.party_id);
      if (!a) continue;
      totalVotes.set(a.id, (totalVotes.get(a.id) ?? 0) + c.votes);
      if (a.id !== winner?.id) wastedVotes.set(a.id, (wastedVotes.get(a.id) ?? 0) + c.votes);
    }
  }
  const stats: { id: string; name: string; color: string; total: number; wasted: number; wastedPct: number }[] = [];
  for (const [id, total] of totalVotes) {
    const a = ctx.alliances.find(x => x.id === id);
    if (!a || total === 0) continue;
    const w = wastedVotes.get(id) ?? 0;
    stats.push({ id, name: a.name, color: a.color, total, wasted: w, wastedPct: (w / total) * 100 });
  }
  if (stats.length === 0) return null;
  stats.sort((a, b) => b.wastedPct - a.wastedPct);
  const rows: SummaryRow[] = stats.map(s => ({
    id: `alliance:${s.id}`, label: s.name, value: roundPct(s.wastedPct), valueFormat: 'pct' as const,
    extra: [int(s.total), int(s.wasted)], color: s.color,
    bar: { value: roundPct(s.wastedPct), max: 100, color: s.color },
  }));
  if (stats.length >= 2) {
    const byTotal = [...stats].sort((a, b) => b.total - a.total);
    const diff = byTotal[0].wastedPct - byTotal[1].wastedPct;
    const adv = diff < 0 ? byTotal[0] : byTotal[1];
    rows.push({ id: 'efficiency_gap', label: '', labelKey: 'studio_row_efficiency_gap', sub: adv.name, value: roundPct(Math.abs(diff)), valueFormat: 'pct', color: adv.color });
  }
  return { id: 'wasted', titleKey: 'studio_sum_wasted', columnsKeys: ['studio_col_wasted_pct', 'studio_col_total_votes', 'studio_col_wasted'], rows };
}

export function overviewSummary(ctx: SummaryContext): SummarySection[] {
  const led = ledSeats(ctx);
  const out: (SummarySection | null)[] = [];
  out.push(voteVsSeats(ctx, led));

  const byMargin = [...led].sort((a, b) => a.margin! - b.margin!);
  const list = (id: string, key: string, seats: SeatResult[]): SummarySection | null => seats.length === 0 ? null
    : { id, titleKey: key, rows: seats.map(s => marginRow(`seat:${s.id}`, s, colorOf(ctx, s.party), s.party)) };
  // OverviewSection.tsx:43-51 — closest 10 / biggest (legacy 5, the brief asks for 10).
  out.push(list('closest', 'studio_sum_closest', byMargin.slice(0, LIST_LIMIT)));
  out.push(list('biggest', 'studio_sum_biggest', [...byMargin].reverse().slice(0, LIST_LIMIT)));

  if (led.length > 0) {
    // OverviewSection.tsx:28-41 — margin histogram.
    const b = buckets(ctx);
    const ids = b.map(() => [] as string[]);
    led.forEach(s => ids[bucketIndex(s.margin!, b)].push(s.id));
    const max = Math.max(...ids.map(x => x.length), 1);
    out.push({
      id: 'margin_dist', titleKey: 'studio_sum_margin_dist',
      rows: b.map((x, i) => ({ id: `bucket:${i}`, label: x.label, value: ids[i].length, valueFormat: 'int' as const, seatIds: ids[i], bar: { value: ids[i].length, max, color: 'var(--color-accent)' } })),
      chart: { type: 'bar', xKey: 'bucket', yKey: 'seats', series: [{ id: 'seats', label: 'Seats', labelKey: 'studio_col_seats', color: 'var(--color-accent)', points: b.map((x, i) => ({ x: x.label, y: ids[i].length })) }] },
    });
  }
  out.push(wasted(ctx));
  out.push(reserved(ctx));

  const order = ['vote_vs_seats', 'closest', 'biggest', 'margin_dist', 'wasted', 'reserved'];
  return (out.filter(Boolean) as SummarySection[]).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
