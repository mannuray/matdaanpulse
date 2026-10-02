import type { ResultRow } from '../types';

export interface PartyElectionStats { won: number; leading: number; contested: number; votePct: number | null; alliance: { id: string; name: string } | null }

export function partyElectionStats(partyId: string, results: ResultRow[], votePct: Map<string, number>, alliances: { id: string; name: string; parties: string[] }[]): PartyElectionStats {
  const seats = new Set<string>();
  let won = 0, leading = 0;
  for (const r of results) {
    if (r.party_id !== partyId) continue;
    seats.add(r.const_id);
    if (r.status === 'WON') won++;
    else if (r.status === 'LEADING') leading++;
  }
  const a = alliances.find(x => x.parties.includes(partyId));
  return { won, leading, contested: seats.size, votePct: votePct.get(partyId) ?? null, alliance: a ? { id: a.id, name: a.name } : null };
}
