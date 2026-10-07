import { NOTA, type CandidateIn, type ElectionIn, type SeatIn } from './types';

export interface Who { person_id: string | null; name: string }
export interface Match { seat: SeatIn; cand: CandidateIn; match: 'person' | 'name' }

/** Upper-case letters only, "X alias Y" → X (today's incumbency rule). */
export function normName(n: string): string {
  return n.toUpperCase().trim().replace(/\s+ALIAS\s+.*/i, '').replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** The same person: same person_id, else the same normalised name (older elections are only partly person-linked). */
export function samePerson(a: Who, b: Who): boolean {
  if (a.person_id && b.person_id && a.person_id === b.person_id) return true;
  const n = normName(a.name);
  return n !== '' && n === normName(b.name);
}

/**
 * `who` among an election's candidates (spec §3.1): by person_id anywhere; else by name in the seat `constNo`; else by
 * name anywhere in the election only when that name is unique there.
 */
export function findPerson(who: Who, e: ElectionIn, constNo: number): Match | null {
  const real = (c: CandidateIn) => c.party_id !== NOTA;
  if (who.person_id) {
    for (const seat of e.seats) {
      const cand = seat.candidates.find(c => real(c) && c.person_id === who.person_id);
      if (cand) return { seat, cand, match: 'person' };
    }
  }
  const n = normName(who.name);
  if (!n) return null;
  const home = e.seats.find(s => s.const_no === constNo);
  const here = home?.candidates.find(c => real(c) && normName(c.name) === n);
  if (home && here) return { seat: home, cand: here, match: 'name' };
  const all = e.seats.flatMap(seat => seat.candidates.filter(c => real(c) && normName(c.name) === n).map(cand => ({ seat, cand })));
  return all.length === 1 ? { ...all[0], match: 'name' } : null;
}
