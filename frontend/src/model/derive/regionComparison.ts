/**
 * Region comparison for an election whose boundaries changed (Assam 2026 vs 2021): seats cannot be compared one by one,
 * so vote share and seats are compared statewide and per region. Each year is grouped by its own manifest's alliances
 * (matched by id; a party in no alliance counts as Others). Pure: no React.
 */

export interface RegionShares { regions: { id: number; name: string; seats: number; parties: { party_id: string; votes: number; won: number }[] }[] }
export interface Alliance { id: string; name: string; color: string; parties: string[] }
export interface RegionGroup { id: string; label: string; color: string; share: [number | null, number | null]; won: [number, number] }
/** Previous election first, current second in every pair. */
export interface RegionRow { name: string; seats: [number, number]; groups: RegionGroup[] }

type Parties = RegionShares['regions'][number]['parties'];
type Tally = Map<string, { votes: number; won: number }>;

const OTHERS = 'OTHERS';
const groupOf = (alliances: Alliance[], party: string) => alliances.find(a => a.parties.includes(party))?.id ?? OTHERS;

function tally(parties: Parties, alliances: Alliance[]): { t: Tally; total: number } {
  const t: Tally = new Map();
  let total = 0;
  for (const p of parties) {
    const g = groupOf(alliances, p.party_id);
    const x = t.get(g) ?? { votes: 0, won: 0 };
    x.votes += p.votes; x.won += p.won;
    t.set(g, x);
    total += p.votes;
  }
  return { t, total };
}

const pct = (v: number | undefined, total: number) => (v === undefined || total === 0 ? null : Math.round((v / total) * 1000) / 10);

export function compareRegions(cur: RegionShares, prev: RegionShares, curAlliances: Alliance[], prevAlliances: Alliance[]): RegionRow[] {
  const meta = new Map<string, { label: string; color: string }>([[OTHERS, { label: 'Others', color: 'var(--color-fallback)' }]]);
  for (const a of [...prevAlliances, ...curAlliances]) meta.set(a.id, { label: a.name, color: a.color });
  const statewide = (s: RegionShares) => ({ name: 'Statewide', seats: s.regions.reduce((n, r) => n + r.seats, 0), parties: s.regions.flatMap(r => r.parties) });
  const empty = { seats: 0, parties: [] as Parties };
  const pairs = [
    [statewide(prev), statewide(cur)],
    ...cur.regions.map(c => [prev.regions.find(p => p.name === c.name) ?? { ...empty, name: c.name }, c]),
  ];
  return pairs.map(([p, c]) => {
    const a = tally(p.parties, prevAlliances), b = tally(c.parties, curAlliances);
    const ids = [...new Set([...b.t.keys(), ...a.t.keys()])].sort((x, y) =>
      x === OTHERS ? 1 : y === OTHERS ? -1 : (b.t.get(y)?.votes ?? 0) - (b.t.get(x)?.votes ?? 0) || (a.t.get(y)?.votes ?? 0) - (a.t.get(x)?.votes ?? 0));
    return {
      name: c.name,
      seats: [p.seats, c.seats] as [number, number],
      groups: ids.map(id => ({
        id, ...meta.get(id)!,
        share: [pct(a.t.get(id)?.votes, a.total), pct(b.t.get(id)?.votes, b.total)] as [number | null, number | null],
        won: [a.t.get(id)?.won ?? 0, b.t.get(id)?.won ?? 0] as [number, number],
      })),
    };
  });
}
