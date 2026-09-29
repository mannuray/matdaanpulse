/**
 * Pure logic for applying SSE live events to local dashboard state.
 *
 * SSE payload (`result-update` / `batch-update` rows):
 *   { const_id, p: party_id, m: margin, s: status, r?: round_no, cr?: current_round, tr?: total_rounds }
 *
 * `p`/`s` describe the result row that was overridden, which is not
 * necessarily the seat leader (s may be TRAILING). Only WON/LEADING rows
 * establish a seat's leader.
 */
import type { ResultRow, SSEResultData, ToastMessage } from '../types';

export interface LeaderPatch {
  party_id: string;
  margin: number;
  status: 'WON' | 'LEADING';
}

export interface LeaderChange {
  const_id: string;
  party_id: string;
  prevParty?: string;
  margin: number;
  /** 'won' = seat declared for this party; 'lead' = new party took the lead. */
  kind: 'won' | 'lead';
}

export const MAX_TOASTS = 5;

function isLeaderStatus(s: string): s is 'WON' | 'LEADING' {
  return s === 'WON' || s === 'LEADING';
}

/**
 * Apply a batch of SSE rows to the leader overlay.
 * Returns a new overlay (or the same instance if nothing changed) and the
 * list of leader changes relative to the effective state before the batch.
 */
export function applyLiveRows(
  overlay: Map<string, LeaderPatch>,
  rows: SSEResultData[],
  baseWinners: Map<string, Pick<ResultRow, 'party_id' | 'status'>>,
): { overlay: Map<string, LeaderPatch>; changes: LeaderChange[] } {
  let next = overlay;
  const changes: LeaderChange[] = [];
  for (const row of rows) {
    if (!row?.const_id || !row.p || !isLeaderStatus(row.s)) continue;
    const prev = next.get(row.const_id) ?? baseWinners.get(row.const_id);
    const prevParty = prev?.party_id;
    const prevStatus = prev?.status;
    const patch: LeaderPatch = { party_id: row.p, margin: Number(row.m) || 0, status: row.s };
    if (next === overlay) next = new Map(overlay);
    next.set(row.const_id, patch);
    if (prevParty !== row.p) {
      changes.push({ const_id: row.const_id, party_id: row.p, prevParty, margin: patch.margin, kind: row.s === 'WON' ? 'won' : 'lead' });
    } else if (row.s === 'WON' && prevStatus !== 'WON') {
      changes.push({ const_id: row.const_id, party_id: row.p, prevParty, margin: patch.margin, kind: 'won' });
    }
  }
  return { overlay: next, changes };
}

/**
 * Merge the live overlay on top of the fetched winner map. Candidate names
 * are taken from the fetched rows for the same party when available.
 */
export function mergeWinnerOverlay(
  base: Map<string, ResultRow>,
  overlay: Map<string, LeaderPatch>,
  constCandidates: Map<string, ResultRow[]>,
): Map<string, ResultRow> {
  if (overlay.size === 0) return base;
  const merged = new Map(base);
  for (const [constId, patch] of overlay) {
    const row = constCandidates.get(constId)?.find(c => c.party_id === patch.party_id);
    merged.set(constId, {
      const_id: constId,
      party_id: patch.party_id,
      candidate_name: row?.candidate_name || '',
      votes: row?.votes || 0,
      const_type: row?.const_type,
      status: patch.status,
      margin: patch.margin,
    });
  }
  return merged;
}

/** Build toast messages for leader changes and append them, keeping only the newest `max`. */
export function appendToasts(
  existing: ToastMessage[],
  changes: LeaderChange[],
  resolve: (partyId: string, constId: string) => { party: string; color: string; constName: string },
  now: number = Date.now(),
  max: number = MAX_TOASTS,
): ToastMessage[] {
  if (changes.length === 0) return existing;
  const added = changes.map((c, i): ToastMessage => {
    const info = resolve(c.party_id, c.const_id);
    return {
      id: `${c.const_id}-${now}-${i}`,
      constName: info.constName,
      party: info.party,
      color: info.color,
      margin: c.margin,
      kind: c.kind,
      timestamp: now,
    };
  });
  return [...existing, ...added].slice(-max);
}
