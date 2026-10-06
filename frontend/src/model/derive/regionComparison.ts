/**
 * The Regions tab: vote share and seats per region (and statewide), compared with the state's previous election.
 * By party (default: the top parties by current statewide vote, the rest as Others) or by alliance (each year's own
 * manifest alliances, matched by id). With no earlier election the previous figures are null. Pure: no React.
 */

export interface RegionShares { regions: { id: number; name: string; seats: number; const_ids?: string[]; parties: { party_id: string; votes: number; won: number }[] }[] }
export interface Alliance { id: string; name: string; color: string; parties: string[] }
export type Pair = [number | null, number | null];
export interface RegionGroup { id: string; label: string; color: string; share: Pair; won: Pair }
/** Previous election first, current second in every pair. */
/** `seatIds`: the region's current seats (Statewide: all), for the map highlight. */
export interface RegionRow { name: string; seats: Pair; seatIds: string[]; groups: RegionGroup[] }

export interface Labels { statewide: string; others: string }
export type CompareOpts =
  | { mode: 'party'; partyMeta: Map<string, { label: string; color: string }>; topParties?: number; labels: Labels;
      /** Party lineage: a previous-election party id → what it counts as now (rename, merger, split successor). */
      carry?: (party: string) => string }
  | { mode: 'alliance'; curAlliances: Alliance[]; prevAlliances: Alliance[]; labels: Labels };

type Parties = RegionShares['regions'][number]['parties'];
type Tally = Map<string, { votes: number; won: number }>;

export const OTHERS = 'OTHERS';
const OTHERS_COLOR = 'var(--color-fallback)';
export const TOP_PARTIES = 6;

function tally(parties: Parties, groupOf: (party: string) => string): { t: Tally; total: number } {
  const t: Tally = new Map();
  let total = 0;
  for (const p of parties) {
    const g = groupOf(p.party_id);
    const x = t.get(g) ?? { votes: 0, won: 0 };
    x.votes += p.votes; x.won += p.won;
    t.set(g, x);
    total += p.votes;
  }
  return { t, total };
}

const pct = (v: number | undefined, total: number) => (v === undefined || total === 0 ? null : Math.round((v / total) * 1000) / 10);

export function compareRegions(cur: RegionShares, prev: RegionShares | null, o: CompareOpts): RegionRow[] {
  const meta = new Map<string, { label: string; color: string }>([[OTHERS, { label: o.labels.others, color: OTHERS_COLOR }]]);
  let curGroup: (p: string) => string, prevGroup: (p: string) => string;
  if (o.mode === 'party') {
    const votes = new Map<string, number>();
    for (const r of cur.regions) for (const p of r.parties) votes.set(p.party_id, (votes.get(p.party_id) ?? 0) + p.votes);
    const top = new Set([...votes].filter(([id]) => id !== 'IND' && id !== 'NOTA').sort((a, b) => b[1] - a[1]).slice(0, o.topParties ?? TOP_PARTIES).map(([id]) => id));
    for (const id of top) meta.set(id, o.partyMeta.get(id) ?? { label: id, color: OTHERS_COLOR });
    curGroup = p => (top.has(p) ? p : OTHERS);
    const carry = o.carry ?? ((p: string) => p);
    prevGroup = p => { const c = carry(p); return top.has(c) ? c : OTHERS; };
  } else {
    for (const a of [...o.prevAlliances, ...o.curAlliances]) meta.set(a.id, { label: a.name, color: a.color });
    const of = (alliances: Alliance[]) => (p: string) => alliances.find(a => a.parties.includes(p))?.id ?? OTHERS;
    curGroup = of(o.curAlliances); prevGroup = of(o.prevAlliances);
  }
  const statewide = (s: RegionShares) => ({ name: o.labels.statewide, seats: s.regions.reduce((n, r) => n + r.seats, 0), const_ids: s.regions.flatMap(r => r.const_ids ?? []), parties: s.regions.flatMap(r => r.parties) });
  const pairs: [{ seats: number; parties: Parties } | null, { name: string; seats: number; const_ids?: string[]; parties: Parties }][] = [
    [prev ? statewide(prev) : null, statewide(cur)],
    ...cur.regions.map(c => [prev ? prev.regions.find(p => p.name === c.name) ?? { seats: 0, parties: [] } : null, c] as [{ seats: number; parties: Parties } | null, typeof c]),
  ];
  return pairs.map(([p, c]) => {
    const a = p ? tally(p.parties, prevGroup) : null, b = tally(c.parties, curGroup);
    const ids = [...new Set([...b.t.keys(), ...(a?.t.keys() ?? [])])].sort((x, y) =>
      x === OTHERS ? 1 : y === OTHERS ? -1 : (b.t.get(y)?.votes ?? 0) - (b.t.get(x)?.votes ?? 0) || (a?.t.get(y)?.votes ?? 0) - (a?.t.get(x)?.votes ?? 0));
    return {
      name: c.name,
      seats: [p ? p.seats : null, c.seats] as Pair,
      seatIds: c.const_ids ?? [],
      groups: ids.map(id => ({
        id, ...meta.get(id)!,
        share: [a ? pct(a.t.get(id)?.votes, a.total) : null, pct(b.t.get(id)?.votes, b.total)] as Pair,
        won: [a ? a.t.get(id)?.won ?? 0 : null, b.t.get(id)?.won ?? 0] as Pair,
      })),
    };
  });
}
