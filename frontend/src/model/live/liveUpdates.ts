/**
 * Pure helpers for live snapshots: who leads each seat, and what changed
 * between two snapshots (drives the ticker and the "recently changed" pulses).
 */
import type { ResultRow } from '../types';

export interface LeaderChange {
  const_id: string;
  party_id: string;
  prevParty?: string;
  margin: number;
  /** 'won' = seat declared for this party; 'lead' = new party took the lead. */
  kind: 'won' | 'lead';
}

/** Seat → leading/winning row (WON/LEADING only; the highest votes wins if a seat has several). */
export function leaderMap(rows: readonly ResultRow[]): Map<string, ResultRow> {
  const map = new Map<string, ResultRow>();
  for (const r of rows) {
    if (r.status !== 'WON' && r.status !== 'LEADING') continue;
    const cur = map.get(r.const_id);
    if (!cur || r.votes > cur.votes) map.set(r.const_id, r);
  }
  return map;
}

/**
 * Leader changes from one snapshot to the next: a seat whose leading party
 * changed ('lead', or 'won' if it was declared at the same time), or a seat
 * whose leader was just declared the winner ('won').
 */
export function diffLeaders(prev: readonly ResultRow[], next: readonly ResultRow[]): LeaderChange[] {
  const before = leaderMap(prev);
  const after = leaderMap(next);
  const changes: LeaderChange[] = [];
  for (const [constId, row] of after) {
    const old = before.get(constId);
    const margin = Number(row.margin) || 0;
    if (old?.party_id !== row.party_id) {
      changes.push({ const_id: constId, party_id: row.party_id, prevParty: old?.party_id, margin, kind: row.status === 'WON' ? 'won' : 'lead' });
    } else if (row.status === 'WON' && old.status !== 'WON') {
      changes.push({ const_id: constId, party_id: row.party_id, prevParty: old.party_id, margin, kind: 'won' });
    }
  }
  return changes;
}
