import { createHash } from 'crypto';
import type { ElectionJson } from './types';
import type { ExistingSeed, OldCand } from './existing-seed';
import { similarity } from './names';

export type Decision = { action: 'delete'; reason: string } | { action: 'match'; serial: number; reason: string };
export interface Matched { old: OldCand; serial: number; similarity: number }
export interface SeatMatch { constId: string; matched: Matched[]; unmatchedOld: OldCand[]; deleted: OldCand[] }
export const LOW_SIMILARITY = 0.5;
const NAME_MATCH = 0.6;

/** Name-based (v5-shaped) UUID from the given parts: regenerating a seed never changes ids. */
export function stableUuid(...parts: (string | number)[]): string {
  const h = createHash('sha1').update(parts.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** `aliases` maps duplicate party ids to the id the new data uses (party-aliases.json). */
export function matchYear(json: ElectionJson, seed: ExistingSeed, decisions: Record<string, Decision>, aliases: Record<string, string> = {}): SeatMatch[] {
  const constByNo = new Map(seed.constituencies.map(c => [c.constNo, c.id]));
  return json.seats.map(seat => {
    const constId = constByNo.get(seat.constNo);
    if (!constId) throw new Error(`year ${json.year}: no existing constituency for seat ${seat.constNo}`);
    const olds = seed.candidates.filter(c => c.constId === constId);
    const taken = new Set<number>();
    const res: SeatMatch = { constId, matched: [], unmatchedOld: [], deleted: [] };
    const take = (old: OldCand, serial: number) => {
      const c = seat.candidates.find(x => x.serial === serial)!;
      taken.add(serial);
      res.matched.push({ old, serial, similarity: c.partyId === 'NOTA' ? 1 : similarity(old.name, c.name) });
    };
    for (const old of olds) {
      const d = decisions[old.id];
      if (d?.action === 'delete') res.deleted.push(old);
      if (d?.action === 'match') {
        if (!seat.candidates.some(c => c.serial === d.serial)) throw new Error(`decision for ${old.id}: seat ${seat.constNo} has no serial ${d.serial}`);
        take(old, d.serial);
      }
    }
    for (const old of olds) {
      if (decisions[old.id]) continue;
      const party = aliases[old.partyId] ?? old.partyId;
      const pool = seat.candidates.filter(c => c.partyId === party && !taken.has(c.serial));
      const best = pool.map(c => ({ c, s: similarity(old.name, c.name) })).sort((a, b) => b.s - a.s)[0];
      if (pool.length === 1 && party !== 'IND') take(old, pool[0].serial);
      else if (best && best.s >= NAME_MATCH) take(old, best.c.serial);
      else res.unmatchedOld.push(old);
    }
    res.matched.sort((a, b) => olds.indexOf(a.old) - olds.indexOf(b.old));
    return res;
  });
}
