export type SeatStateName = 'not_started' | 'counting' | 'declared' | 'countermanded' | 'adjourned';
export interface Roster { election: { id: string; type: string; state_id: number | null; year: number; status: string };
  parties: { id: string; name: string; abbreviation: string | null }[];
  seats: { const_id: string; const_no: number; name: string; type: string; state_id: number | null; candidates: { candidate_id: string; name: string; party_id: string | null }[] }[] }
export interface SeatState { const_id: string; state: SeatStateName; round?: { current: number; total: number } | null; votes: Record<string, number> }
export interface MappingReport { seats_total: number; seats_mapped: number; unmapped: { ref: string; reason: string }[] }
export interface PartyTally { party_id: string; won: number; leading: number }
export interface SourceAdapter { id: string; intervalMs: number; prepare(roster: Roster): Promise<MappingReport>; poll(): Promise<SeatState[]>; tally?(): Promise<PartyTally[] | null>; /** Called after each delivered chunk with the const_ids the server took (applied / unchanged / stale); an adapter keeps poll()
   *  bookkeeping pending until then, so a seat that was not delivered, or was held or rejected, is sent again on the next poll(). */
  commit?(constIds: string[]): void }
export type AdapterFactory = (opts: Record<string, string>) => SourceAdapter;
export interface IngestConfig { status: string; source: string | null; poll_hint_ms: number; shard: { name: string; seat_count: number }; lease: { holder: string | null; expires_at: string | null } }
export interface SeatsResponse { counts: Record<'applied' | 'unchanged' | 'stale' | 'held' | 'rejected', number>; seats: { const_id: string; outcome: string; reason?: string; detail?: unknown }[] }
