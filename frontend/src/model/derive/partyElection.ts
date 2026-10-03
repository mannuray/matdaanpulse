import type { ResultRow } from '../types';
import { displayNameFromConstId, parseConstId } from '../geo/regionMatching';
import type { LeaderCard, LeaderStatus } from './leaders';

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

/** A key-candidate card in the party dialog: a party leader (seat or not) or one of the party's biggest wins. */
export interface PartyKeyCandidate {
  key: string; name: string; constId: string; constName: string;
  /** Seat number from the id (VS ids carry it), else null. */
  constNo: number | null;
  /** null for a leader without a seat in this election. */
  status: LeaderStatus | null;
  margin: number | null;
  leader: boolean;
}

const seatNo = (constId: string) => { const n = constId ? parseConstId(constId).constNo : undefined; return n ? Number(n) : null; };

export function partyKeyCandidates(partyId: string, leaders: LeaderCard[], winners: Map<string, ResultRow>, limit = 4): PartyKeyCandidate[] {
  const out: PartyKeyCandidate[] = leaders.filter(l => l.partyId === partyId).map(l => ({
    key: `leader|${l.key}`, name: l.name, constId: l.constId, constName: l.constId ? l.constName : '', constNo: seatNo(l.constId),
    status: l.constId ? l.status : null, margin: l.margin, leader: true,
  }));
  const taken = new Set(out.map(c => c.constId).filter(Boolean));
  const wins = [...winners.values()]
    .filter(w => w.party_id === partyId && (w.status === 'WON' || w.status === 'LEADING') && !taken.has(w.const_id))
    .sort((a, b) => (Number(b.margin) || 0) - (Number(a.margin) || 0));
  for (const w of wins) {
    if (out.length >= limit) break;
    out.push({ key: `win|${w.const_id}`, name: w.candidate_name, constId: w.const_id, constName: displayNameFromConstId(w.const_id), constNo: seatNo(w.const_id),
      status: w.status === 'WON' ? 'WON' : 'LEADING', margin: Number(w.margin) || 0, leader: false });
  }
  return out.slice(0, limit);
}
