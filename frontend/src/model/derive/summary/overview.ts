import { roundPct } from '../scoreboard';
import { rankSeats } from '../stats';
import type { SeatResult } from '../../types/dashboard';
import { allianceByParty, bucketIndex, buckets, colorOf, int, intDash, lakh, ledSeats, refRow, partyName, pct, seatIdsOf, wonSeats } from './shared';
import { formatSummaryValue } from './format';
import type { ChartSpec, SummaryContext, SummaryRow, SummarySection } from './types';

const LIST_LIMIT = 10;
const BIGGEST_LIMIT = 5;

/** OverviewSection.tsx:53-67 — reserved (SC/ST) seats per leading party; seats without a leader are excluded. */
function reserved(ctx: SummaryContext): SummarySection | null {
  const map = new Map<string, { color: string; sc: number; st: number; ids: string[] }>();
  for (const s of ctx.seats) {
    if (!s.party || (s.type !== 'SC' && s.type !== 'ST')) continue;
    const pid = s.party;
    const e = map.get(pid) ?? { color: colorOf(ctx, pid), sc: 0, st: 0, ids: [] };
    e.ids.push(s.id);
    if (s.type === 'SC') e.sc++; else e.st++;
    map.set(pid, e);
  }
  if (map.size === 0) return null;
  const rows: SummaryRow[] = [...map.entries()]
    .sort((a, b) => (b[1].sc + b[1].st) - (a[1].sc + a[1].st))
    .map(([pid, e]) => ({
      // Legacy showed "–" for 0 in the SC and ST columns.
      id: `party:${pid}`, label: pid, sub: partyName(ctx, pid), value: e.sc, valueFormat: 'intDash' as const,
      extra: [intDash(e.st), int(e.sc + e.st)], color: e.color, partyIds: [pid], seatIds: e.ids,
    }));
  return { id: 'reserved', titleKey: 'studio_sum_reserved', columnsKeys: ['studio_col_sc', 'studio_col_st', 'studio_col_total'], primaryCol: 2, rows };
}

/**
 * OverviewSection.tsx:153-199 — vote share vs seat share, as an alliance section and a party section (the legacy toggled
 * between them). Columns: difference (seat % − vote %), vote %, seat %; the compact card shows the seat %.
 */
function voteVsSeats(ctx: SummaryContext, led: SeatResult[]): SummarySection[] {
  // Legacy only rendered this when the manifest defines alliances (standings.groups.length > 0).
  if (ctx.alliances.length === 0 || led.length === 0) return [];
  const total = led.length;
  const seatsOf = new Map<string, number>();
  led.forEach(s => seatsOf.set(s.party, (seatsOf.get(s.party) ?? 0) + 1));
  const vote = (id: string) => ctx.votePct.get(id) ?? 0;
  const mk = (id: string, label: string, color: string, seats: number, votePct: number, partyIds: string[], seatIds: string[]): SummaryRow => {
    // The difference is taken between the two displayed (rounded) numbers, so the row always adds up on screen.
    const seatPct = roundPct((seats / total) * 100);
    const votePctR = roundPct(votePct);
    return {
      id, label, value: roundPct(seatPct - votePctR), valueFormat: 'signed1', color, partyIds, seatIds,
      extra: [pct(votePctR), pct(seatPct)],
      bar: { value: seatPct, max: 100, color },
    };
  };
  const alliances = ctx.alliances.map(a => mk(
    `alliance:${a.id}`, a.name, a.color, a.parties.reduce((n, p) => n + (seatsOf.get(p) ?? 0), 0),
    a.parties.reduce((n, p) => n + vote(p), 0), a.parties, seatIdsOf(led, a.parties),
  ));
  const inAlliance = allianceByParty(ctx.alliances);
  const othersSeats = led.filter(s => !inAlliance.has(s.party)).length;
  const othersVote = [...ctx.votePct.entries()].filter(([id]) => !inAlliance.has(id)).reduce((n, [, v]) => n + v, 0);
  const rows = alliances;
  if (othersSeats > 0 || othersVote > 0) {
    const r = mk('others', '', '#6b7280', othersSeats, othersVote, [], led.filter(s => !inAlliance.has(s.party)).map(s => s.id));
    rows.push({ ...r, labelKey: 'others' });
  }
  const seatPctOf = (r: SummaryRow) => r.extra![1].value ?? 0;
  rows.sort((a, b) => seatPctOf(b) - seatPctOf(a));

  const ids = new Set([...ctx.parties.map(p => p.id), ...ctx.votePct.keys()]);
  const qualifying = [...ids].filter(id => (seatsOf.get(id) ?? 0) > 0 || vote(id) >= 1);
  const partyRow = (id: string) => mk(`party:${id}`, partyName(ctx, id), colorOf(ctx, id), seatsOf.get(id) ?? 0, vote(id), [id], seatIdsOf(led, [id]));
  const partyRows = [...qualifying].sort((a, b) => vote(b) - vote(a)).slice(0, LIST_LIMIT).map(partyRow);
  // The chart ranks by seats won (vote share breaks ties), so small seat winners are never dropped for big vote-getters without seats.
  const chartParties = [...qualifying]
    .sort((a, b) => (seatsOf.get(b) ?? 0) - (seatsOf.get(a) ?? 0) || vote(b) - vote(a))
    .slice(0, LIST_LIMIT)
    .map(id => ({ id, row: partyRow(id) }));

  // Two bars per group: vote % (faded) and seat % (full), both in the group's colour; the note above is seat % − vote %.
  const chartOf = (rs: { x: string; row: SummaryRow; name?: string }[]): ChartSpec => {
    const xOf = (g: typeof rs[number]) => g.row.labelKey ?? g.x;
    const pointOf = (g: typeof rs[number], col: number) => ({
      x: xOf(g), y: g.row.extra![col].value ?? 0, color: g.row.color,
      ...(g.row.labelKey ? { labelKey: g.row.labelKey } : {}), ...(g.name ? { label: g.name } : {}),
    });
    const bar = (id: string, labelKey: string, col: number, opacity?: number) => ({
      id, labelKey, color: 'var(--color-ink)', ...(opacity != null ? { opacity } : {}), points: rs.map(g => pointOf(g, col)),
    });
    return {
      type: 'groupedBar', xKey: 'group', valueFormat: 'pct',
      series: [bar('vote', 'studio_col_vote_pct', 0, 0.4), bar('seat', 'studio_col_seat_pct', 1)],
      annotations: rs.map(g => ({ x: xOf(g), text: formatSummaryValue(g.row.value, 'signed1'), tone: (g.row.value ?? 0) > 0 ? 'up' as const : (g.row.value ?? 0) < 0 ? 'down' as const : 'neutral' as const })),
    };
  };
  const allianceChart = chartOf(rows.map(r => ({ x: r.label, row: r })));
  // Parties are labelled by their short id (BJP); the full name rides along for tooltips and the data table.
  const partyChart = chartOf(chartParties.map(({ id, row }) => ({ x: id, row, name: row.label })));
  const cols = { columnsKeys: ['studio_col_disparity', 'studio_col_vote_pct', 'studio_col_seat_pct'], primaryCol: 2 };
  return [
    { id: 'vote_vs_seats_alliances', titleKey: 'studio_sum_vote_vs_seats_alliances', ...cols, rows,
      chart: allianceChart, chartLabelKey: 'studio_tab_alliances', chartAlt: { labelKey: 'studio_tab_parties', titleKey: 'studio_sum_vote_vs_seats_parties', spec: partyChart } },
    { id: 'vote_vs_seats_parties', titleKey: 'studio_sum_vote_vs_seats_parties', ...cols, rows: partyRows },
  ];
}

/** OverviewSection.tsx:254-276 — votes cast for an alliance's parties in seats its alliance did not win. */
function wasted(ctx: SummaryContext, led: SeatResult[]): SummarySection | null {
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
    id: `alliance:${s.id}`, label: s.name, value: s.total, valueFormat: 'lakh' as const,
    extra: [lakh(s.wasted), pct(roundPct(s.wastedPct))], color: s.color, seatIds: seatIdsOf(led, ctx.alliances.find(a => a.id === s.id)?.parties ?? []),
    bar: { value: roundPct(s.wastedPct), max: 100, color: s.color },
  }));
  if (stats.length >= 2) {
    const byTotal = [...stats].sort((a, b) => b.total - a.total);
    const diff = byTotal[0].wastedPct - byTotal[1].wastedPct;
    const adv = diff < 0 ? byTotal[0] : byTotal[1];
    // Legacy: "Efficiency Gap: <alliance> has +N pp advantage" (the number sits in the last column).
    rows.push({ id: 'efficiency_gap', label: '', labelKey: 'studio_row_efficiency_gap', sub: adv.name, value: null, valueFormat: 'text', valueText: '', extra: [{ value: null, format: 'text', text: '' }, { value: roundPct(Math.abs(diff)), format: 'pp' }], color: adv.color });
  }
  return { id: 'wasted', titleKey: 'studio_sum_wasted', columnsKeys: ['studio_col_total', 'studio_col_wasted', 'studio_col_wasted_pct'], primaryCol: 2, rows };
}

export function overviewSummary(ctx: SummaryContext): SummarySection[] {
  const led = ledSeats(ctx);
  const out: (SummarySection | null)[] = [];

  // Same pool as the stat tiles: WON seats, or LEADING seats only while nothing is WON.
  const list = (id: string, key: string, order: 'closest' | 'biggest'): SummarySection | null => {
    const refs = rankSeats(led, order, order === 'closest' ? LIST_LIMIT : BIGGEST_LIMIT);
    return refs.length === 0 ? null : { id, titleKey: key, rows: refs.map(r => refRow(r, colorOf(ctx, r.party))) };
  };
  out.push(list('closest', 'studio_sum_closest_battles', 'closest'));
  out.push(list('biggest', 'studio_sum_biggest', 'biggest'));

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
  out.push(reserved(ctx));
  out.push(...voteVsSeats(ctx, wonSeats(ctx))); // seat shares count seats won unopposed
  out.push(wasted(ctx, led));

  // Legacy order (after the key stats): margin distribution, closest, biggest, reserved, vote vs seats, wasted votes.
  const order = ['margin_dist', 'closest', 'biggest', 'reserved', 'vote_vs_seats_alliances', 'vote_vs_seats_parties', 'wasted'];
  return (out.filter(Boolean) as SummarySection[]).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
