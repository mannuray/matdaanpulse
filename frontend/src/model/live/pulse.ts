import type { LeaderChange } from './liveUpdates';
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
