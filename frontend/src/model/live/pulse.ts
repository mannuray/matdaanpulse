import { diffLeaders, type LeaderChange } from './liveUpdates';
import type { ResultRow } from '../types';
import type { Upset } from '../derive/seatAnalysis';

/** A recent change's kind, for the map pulse colour (spec §3.3). */
export type PulseKind = 'upset' | 'switch' | 'declared' | 'update';
const RANK: Record<PulseKind, number> = { update: 0, declared: 1, switch: 2, upset: 3 };

/** Upsets present in `next` but not in `prev`, per seat. */
export function newUpsets(prev: Map<string, Upset[]>, next: Map<string, Upset[]>): { const_id: string; upset: Upset }[] {
  const out: { const_id: string; upset: Upset }[] = [];
  for (const [id, list] of next) for (const u of list) if (!(prev.get(id) ?? []).includes(u)) out.push({ const_id: id, upset: u });
  return out;
}

/** Each changed seat's pulse kind: upset > lead switch > declared > other update. */
export function pulseKinds(changes: LeaderChange[], prevUpsets: Map<string, Upset[]>, nextUpsets: Map<string, Upset[]>): Map<string, PulseKind> {
  const out = new Map<string, PulseKind>();
  const put = (id: string, k: PulseKind) => { const cur = out.get(id); if (!cur || RANK[k] > RANK[cur]) out.set(id, k); };
  for (const c of changes) put(c.const_id, c.kind === 'won' && c.prevParty === c.party_id ? 'declared' : c.prevParty && c.prevParty !== c.party_id ? 'switch' : c.kind === 'won' ? 'declared' : 'update');
  for (const u of newUpsets(prevUpsets, nextUpsets)) put(u.const_id, 'upset');
  return out;
}

/** What the dashboard remembers between live snapshots (the previous snapshot's results and upsets). */
export interface LiveStepState {
  electionId: string;
  version: number;
  results: ResultRow[];
  upsets: Map<string, Upset[]>;
}

/**
 * One step of the live feed: the pulses, leader changes and new upsets between the previous snapshot and this one.
 * - The first snapshot, an election switch or an older version is a new baseline: no events.
 * - The same version again (e.g. the baseline / live analysis arrived after the snapshot) quietly refreshes the
 *   upsets, so upsets that already existed never show up as news on the next poll.
 */
export function liveStep(prev: LiveStepState | null, next: LiveStepState): { state: LiveStepState; kinds: Map<string, PulseKind>; changes: LeaderChange[]; ups: { const_id: string; upset: Upset }[] } {
  const none = { kinds: new Map<string, PulseKind>(), changes: [] as LeaderChange[], ups: [] as { const_id: string; upset: Upset }[] };
  if (!prev || prev.electionId !== next.electionId || next.version < prev.version) return { state: next, ...none };
  if (next.version === prev.version) return { state: { ...prev, upsets: next.upsets }, ...none };
  const changes = diffLeaders(prev.results, next.results);
  return { state: next, kinds: pulseKinds(changes, prev.upsets, next.upsets), changes, ups: newUpsets(prev.upsets, next.upsets) };
}
