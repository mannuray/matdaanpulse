import type { LineageEventLike } from './lineage';

/** Bumped when the stored shape changes (constituency_analysis.schema_version, election_analysis.schema_version). */
export const SCHEMA_VERSION = 1;
export const NOTA = 'NOTA';
export const INDEPENDENT = 'IND';
/** Alliance ids that are the same bloc across elections (Congress-led UPA before 2023 counts as INDIA). */
export const ALLIANCE_ALIASES: Record<string, string> = { UPA: 'INDIA' };

export interface CandidateIn { person_id: string | null; name: string; party_id: string | null; votes: number; status: string }
export interface SeatIn {
  const_id: string;
  const_no: number;
  reserved: 'GEN' | 'SC' | 'ST';
  region_id: number | null;
  /** Turnout %, when known. */
  turnout: number | null;
  /** Registered electors, when known (live: votes still to count). */
  electors: number | null;
  candidates: CandidateIn[];
}
export interface AllianceIn { id: string; parties: string[] }
export interface ElectionIn {
  id: string;
  year: number;
  /** Counting date YYYY-MM-DD (else `${year}-07-01`): the lineage comparison window. */
  date: string;
  seats: SeatIn[];
  alliances: AllianceIn[];
  /** Parties of the government formed after these results (manifest `government.parties`); null = unknown. */
  government: string[] | null;
}
export interface VoteSplitIn { spoiler: string; hurts: string; label?: string }
export type HeavyweightReason = 'leader' | 'cabinet' | 'state_president' | 'legislature_leader';
export interface HeavyweightIn { person_id: string | null; name: string; party_id: string | null; reason: HeavyweightReason }
export interface AnalysisInput {
  stateId: number | null;
  current: ElectionIn;
  voteSplits: VoteSplitIn[];
  heavyweights: HeavyweightIn[];
  /** Comparable earlier elections (same type, state, delimitation), oldest → newest. */
  history: ElectionIn[];
  /** The previous election of the same type and state, any delimitation (party totals compare across a redraw). */
  previousAny: ElectionIn | null;
  lineage: LineageEventLike[];
}

export interface Placed { name: string; person_id: string | null; party_id: string | null; votes: number; share: number | null }
export type OutcomeKind = 'retained' | 'gained' | 'split' | 'new';
/** `from` = the previous holder carried to this election's party ids (JVM → BJP); `from_raw` = as it was. */
export interface Outcome { kind: OutcomeKind; from: string | null; from_raw: string | null }
export type ClassKind = 'stronghold' | 'loyal' | 'swing' | 'new';
export interface SeatClass { kind: ClassKind; holder: string; streak: number; since: number; wins: number; total: number }
export interface Incumbency {
  name: string;
  person_id: string | null;
  party: string | null;
  match: 'person' | 'name' | null;
  recontested: boolean;
  /** Where they contest now (null: not a candidate). */
  const_id: string | null;
  same_seat: boolean;
  party_now: string | null;
  switched: boolean;
  followed_split: boolean;
  /** null when not re-contesting. */
  won: boolean | null;
}
export interface HistoryEntry {
  year: number;
  party: string | null;
  /** The party carried to the current election's ids (lineage family); IND stays IND. */
  family: string | null;
  candidate: string;
  person_id: string | null;
  margin: number | null;
  vote_share: number | null;
  runner_up: string | null;
  runner_up_party: string | null;
}
export type SeatType = 'two-way' | 'three-way' | 'multi-cornered';
export type SeatNote =
  | { kind: 'spoiler'; name: string; party: string | null; votes: number; margin: number; hurts?: string; label?: string }
  | { kind: 'nota'; votes: number; margin: number }
  | { kind: 'rematch'; names: [string, string] }
  | { kind: 'revenge'; name: string; beat: string }
  | { kind: 'switcher'; name: string; from: string; to: string; year: number; match: 'person' | 'name' }
  | { kind: 'heavyweight'; name: string; party: string | null; reasons: HeavyweightReason[] }
  | { kind: 'bellwether'; elections: number };
export interface SeatAnalysis {
  schema_version: number;
  const_id: string;
  const_no: number;
  winner: Placed | null;
  runner_up: Placed | null;
  margin: number | null;
  margin_pct: number | null;
  total_votes: number;
  /** The winner is only LEADING. */
  provisional: boolean;
  outcome: Outcome | null;
  swing: { winner_party: number | null; prev_holder: number | null } | null;
  class: SeatClass | null;
  incumbent: Incumbency | null;
  /** Comparable elections with a winner, this one included, oldest → newest. */
  history: HistoryEntry[];
  seat_type: SeatType | null;
  notes: SeatNote[];
}

export interface PartyRow {
  party_id: string;
  contested: number;
  won: number;
  votes: number;
  share: number;
  /** Against `previousAny` (carried through lineage); null when there is none. */
  prev: { won: number; share: number } | null;
  held: number;
  gained: number;
  lost: number;
  split_gained: number;
  split_lost: number;
}
export interface FamilyRow { root: string; members: string[]; won: number; share: number }
export interface FlowRow { from: string; to: string; seats: number; split: boolean }
export interface AllianceChange {
  moves: { from: string; to: string; seats: number }[];
  within: { alliance: string; seats: number }[];
  shares: { alliance: string; share: number; prev_share: number | null }[];
}
export interface BreakdownRow { group: string; seats: number; parties: { party_id: string; won: number; share: number }[] }
export interface ElectionAnalysis {
  schema_version: number;
  election_id: string;
  prev_election_id: string | null;
  prev_any_election_id: string | null;
  total_votes: number;
  parties: PartyRow[];
  families: FamilyRow[];
  flow: FlowRow[];
  alliance: AllianceChange | null;
  close_seats: string[];
  narrowing_seats: string[];
  bellwethers: string[];
  breakdowns: { reserved: BreakdownRow[]; region: BreakdownRow[]; turnout: BreakdownRow[] };
}
