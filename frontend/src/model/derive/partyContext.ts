/**
 * What the party dialog says about a party in one state's election (migration 023): its unit there (recognition, current
 * state president and legislature leader), its lineage in plain terms, and its family's seats when it is part of a split.
 * Pure.
 */
import { familyOf } from './comparableParties';
import type { LineageEvent, PartyUnit } from '../types';

export interface UnitPerson { name: string; personId: string | null }
export interface PartyUnitSummary { stateName: string; recognition: PartyUnit['eci_recognition']; president: UnitPerson | null; legislatureLeader: UnitPerson | null }
export type LineageNote =
  | { kind: 'formerly' | 'absorbed' | 'successorOf' | 'factionOf' | 'brokeAwayFrom' | 'renamedTo' | 'mergedInto'; other: string; year: number };
export interface PartyFamily { root: string; members: { id: string; seats: number }[]; total: number }

/** `relevant`: whether another party matters in this state (contested or won there); notes about others need it. */
export function partyContext(o: { partyId: string; units: PartyUnit[]; events: LineageEvent[]; stateId: number | null; date: string; seats: Map<string, number>; relevant?: (partyId: string) => boolean }):
  { unit: PartyUnitSummary | null; notes: LineageNote[]; family: PartyFamily | null } {
  const u = o.stateId == null ? undefined : o.units.find(x => x.state_id === o.stateId);
  const current = (role: string): UnitPerson | null => {
    const r = u?.roles.find(x => x.role === role && x.to_date === null);
    return r ? { name: r.person_name, personId: r.person_id } : null;
  };
  const unit = u ? { stateName: u.state_name, recognition: u.eci_recognition, president: current('state_president'), legislatureLeader: current('legislature_leader') } : null;

  const relevant = o.relevant ?? (() => true);
  const here = o.events.filter(e => (e.state_id == null || e.state_id === o.stateId) && relevant(e.party_id === o.partyId ? e.predecessor_id : e.party_id));
  const year = (e: LineageEvent) => Number(e.effective_date.slice(0, 4));
  const notes: LineageNote[] = [];
  for (const e of here) {
    if (e.party_id === o.partyId) {
      const kind = e.kind === 'rename' ? 'formerly' : e.kind === 'merger' ? 'absorbed' : e.kind === 'breakaway' ? 'brokeAwayFrom' : e.is_successor ? 'successorOf' : 'factionOf';
      notes.push({ kind, other: e.predecessor_id, year: year(e) });
    } else if (e.predecessor_id === o.partyId && (e.kind === 'rename' || e.kind === 'merger')) {
      notes.push({ kind: e.kind === 'rename' ? 'renamedTo' : 'mergedInto', other: e.party_id, year: year(e) });
    }
  }

  const f = familyOf(here, o.partyId, o.date, o.stateId);
  const family = f.members.length > 1
    ? { root: f.root, members: f.members.map(id => ({ id, seats: o.seats.get(id) ?? 0 })), total: f.members.reduce((n, id) => n + (o.seats.get(id) ?? 0), 0) }
    : null;
  return { unit, notes, family };
}
