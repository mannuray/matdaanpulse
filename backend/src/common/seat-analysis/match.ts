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

/** Like samePerson, but two different person_ids never match (heavyweights: a namesake is not the leader). */
export function strictSamePerson(a: Who, b: Who): boolean {
  if (a.person_id && b.person_id) return a.person_id === b.person_id;
  return samePerson(a, b);
}

interface PersonIndex {
  /** person_id → its first candidacy in seat order. */
  byPerson: Map<string, Match>;
  /** normalised name → every candidacy with that name, in seat order. */
  byName: Map<string, Match[]>;
}
// Built once per election object (an election is never mutated after it is assembled; a live update builds a new one).
const indexes = new WeakMap<ElectionIn, PersonIndex>();

function indexOf(e: ElectionIn): PersonIndex {
  let idx = indexes.get(e);
  if (idx) return idx;
  idx = { byPerson: new Map(), byName: new Map() };
  for (const seat of e.seats) {
    for (const cand of seat.candidates) {
      if (cand.party_id === NOTA) continue;
      if (cand.person_id && !idx.byPerson.has(cand.person_id)) idx.byPerson.set(cand.person_id, { seat, cand, match: 'person' });
      const n = normName(cand.name);
      if (!n) continue;
      const list = idx.byName.get(n) ?? [];
      list.push({ seat, cand, match: 'name' });
      idx.byName.set(n, list);
    }
  }
  indexes.set(e, idx);
  return idx;
}

/**
 * `who` among an election's candidates (spec §3.1): by person_id anywhere; else by name in the seat `constNo`; else by
 * name anywhere in the election only when that name is unique there.
 */
export function findPerson(who: Who, e: ElectionIn, constNo: number): Match | null {
  const idx = indexOf(e);
  if (who.person_id) {
    const m = idx.byPerson.get(who.person_id);
    if (m) return m;
  }
  const n = normName(who.name);
  if (!n) return null;
  const all = idx.byName.get(n) ?? [];
  return all.find(m => m.seat.const_no === constNo) ?? (all.length === 1 ? all[0] : null);
}
