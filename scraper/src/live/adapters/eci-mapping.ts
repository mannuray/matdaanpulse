import type { Roster, SeatStateName } from '../types';

export const normName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

/** ECI party label → our party id: NOTA, Independent, full name, "Full Name - ABBR", abbreviation, then the per-election aliases. */
export function mapParty(eciParty: string, parties: Roster['parties'], aliases: Record<string, string>): string | null {
  const raw = eciParty.trim();
  if (/^none of the above$/i.test(raw)) return 'NOTA';
  if (/^independent$/i.test(raw)) return 'IND';
  if (aliases[raw]) return aliases[raw];
  const [full, abbr] = raw.includes(' - ') ? raw.split(/ - (?=[^-]+$)/) : [raw, null];
  const n = normName(full);
  return parties.find(p => normName(p.name) === n)?.id
    ?? (abbr ? parties.find(p => p.abbreviation && normName(p.abbreviation) === normName(abbr))?.id : undefined)
    ?? parties.find(p => p.abbreviation && normName(p.abbreviation) === n)?.id
    ?? null;
}

/** Every roster candidate must be matched (full state per seat). Name + party first, then the party when unique in the seat (never IND). */
export function mapCandidates(seat: Roster['seats'][number], eci: { name: string; party: string; votes: number }[], parties: Roster['parties'], aliases: Record<string, string>): { votes: Record<string, number> } | { reason: string } {
  const votes: Record<string, number> = {};
  const free = new Set(seat.candidates.map(c => c.candidate_id));
  for (const e of eci) {
    const pid = mapParty(e.party, parties, aliases);
    if (!pid) return { reason: `unmapped party ${e.party}` };
    const pool = seat.candidates.filter(c => free.has(c.candidate_id) && c.party_id === pid);
    const byName = pool.find(c => pid === 'NOTA' || normName(c.name) === normName(e.name));
    const pick = byName ?? (pool.length === 1 && pid !== 'IND' ? pool[0] : undefined);
    if (!pick) return { reason: `unmapped candidate ${e.name} (${e.party})` };
    votes[pick.candidate_id] = e.votes;
    free.delete(pick.candidate_id);
  }
  if (free.size) return { reason: `missing candidates: ${seat.candidates.filter(c => free.has(c.candidate_id)).map(c => c.name).join(', ')}` };
  return { votes };
}

export function seatStateFrom(rounds: string, status: string): { state: SeatStateName; round: { current: number; total: number } | null } {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(rounds);
  const round = m ? { current: Number(m[1]), total: Number(m[2]) } : null;
  if (/result declared/i.test(status)) return { state: 'declared', round };
  if (/countermand/i.test(status)) return { state: 'countermanded', round };
  if (/adjourn/i.test(status)) return { state: 'adjourned', round };
  if (!round || round.current === 0) return { state: round ? 'not_started' : 'counting', round };
  return { state: 'counting', round };
}
