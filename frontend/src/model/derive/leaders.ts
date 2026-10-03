import type { ManifestData, ResultRow } from '../types';
import { displayNameFromConstId } from '../geo/regionMatching';

export interface LeaderEntry {
  name: string;
  partyId: string;
  constId: string;
  role?: string;
}

export type LeaderStatus = 'WON' | 'LEADING' | 'LOST' | 'TRAILING' | 'PENDING';

export interface LeaderCard {
  key: string;
  name: string;
  role?: string;
  constId: string;
  constName: string;
  partyId: string;
  status: LeaderStatus;
  margin: number | null;
  custom: boolean;
}

export interface CustomWatch {
  const_id: string;
  label: string;
}

type Entry = LeaderEntry & { custom: boolean };

export function collectLeaderEntries(manifest: ManifestData | null, custom: CustomWatch[]): Entry[] {
  const out: Entry[] = [];
  const seen = new Set<string>();
  const push = (e: Entry) => {
    const key = `${e.constId}|${e.name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };
  const watchlists = manifest?.watchlists?.filter(w => w.entries.length > 0) ?? [];
  if (watchlists.length > 0) {
    watchlists.forEach(w => w.entries.forEach(x => push({ name: x.name, partyId: x.party_id, constId: x.const_id, role: x.role, custom: false })));
  } else {
    manifest?.leaders?.forEach(l => push({ name: l.name, partyId: l.party_id, constId: l.const_id, custom: false }));
    manifest?.cabinet?.forEach(c => push({ name: c.name, partyId: c.party_id, constId: c.const_id, role: c.role, custom: false }));
  }
  custom.forEach(c => push({ name: c.label, partyId: '', constId: c.const_id, custom: true }));
  return out;
}

const tokens = (name: string) => name.toUpperCase().replace(/[^\p{L}\p{M}\s]/gu, ' ').split(/\s+/).filter(Boolean);

/**
 * Manifest leaders often come without a seat (const_id ""). Find it from this election's results: the one candidate of
 * the leader's party whose name contains every token of the leader's name ("Tejashwi Yadav" → "TEJASHWI PRASAD YADAV").
 * No match, or more than one, leaves the leader seatless (no guessing).
 */
export function resolveLeaderSeats<E extends LeaderEntry>(entries: E[], results: ResultRow[]): E[] {
  return entries.map(e => {
    if (e.constId || !e.partyId) return e;
    const want = tokens(e.name);
    if (!want.length) return e;
    const hits = new Set(results.filter(r => r.party_id === e.partyId && want.every(t => tokens(r.candidate_name).includes(t))).map(r => r.const_id));
    return hits.size === 1 ? { ...e, constId: [...hits][0] } : e;
  });
}

export function deriveLeaderCards(entries: Entry[], winners: Map<string, ResultRow>): LeaderCard[] {
  return entries.map(e => {
    const w = winners.get(e.constId);
    let status: LeaderStatus = 'PENDING';
    if (w) {
      const isEntryParty = !e.partyId || e.partyId === w.party_id;
      const declared = w.status === 'WON';
      status = isEntryParty ? (declared ? 'WON' : 'LEADING') : (declared ? 'LOST' : 'TRAILING');
    }
    return {
      key: `${e.constId}|${e.name}`,
      name: e.custom && w ? w.candidate_name : e.name,
      role: e.role,
      constId: e.constId,
      constName: displayNameFromConstId(e.constId),
      partyId: e.partyId || w?.party_id || '',
      status,
      margin: w ? Number(w.margin) || 0 : null,
      custom: e.custom,
    };
  });
}
