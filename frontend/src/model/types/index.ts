import type { SeatAnalysis, SeatTrail } from '../derive/seatAnalysis';
export interface State {
  id: number;
  name: string;
  code: string;
  total_assembly_seats: number;
  total_ls_seats: number;
  election_count?: number;
}

export interface District {
  id: number;
  state_id: number;
  name: string;
  code: string;
}

export interface Election {
  id: string;
  name: string;
  type: 'LS' | 'VS';
  state_id: number | null;
  state: State | null;
  year: number;
  status: 'Upcoming' | 'Live' | 'Finalized';
  tentative_next_date: string | null;
  /** Delimitation order year the seats follow ("2008"); null = not known (compared with nothing). */
  delimitation?: string | null;
}

export interface Party {
  id: string;
  name: string;
  color: string | null;
  abbreviation?: string | null;
  symbol_url: string | null;
  eci_symbol_url: string | null;
  eci_recognition?: 'National' | 'State' | 'Unrecognised' | null;
}

export interface PartyDetail extends Party {
  leader_name: string | null;
  founded_year: number | null;
  headquarters: string | null;
  website: string | null;
  wikipedia_url: string | null;
  description: string | null;
  /** Per-state units (migration 023): recognition there, office, leadership terms (current first). */
  units?: PartyUnit[];
  /** Lineage events where this party is either side. */
  lineage?: LineageEvent[];
}

/** A party came from a predecessor: rename, merger or split (state_id: only in that state's comparisons). */
export interface LineageEvent {
  party_id: string;
  predecessor_id: string;
  kind: 'rename' | 'merger' | 'split' | 'breakaway';
  effective_date: string;
  state_id: number | null;
  is_successor: boolean;
  note: string | null;
  /** Where the event is documented. */
  source_url?: string | null;
}

export interface PartyUnitRole {
  role: 'state_president' | 'legislature_leader';
  person_id: string | null;
  person_name: string;
  from_date: string | null;
  to_date: string | null;
  /** The holder's photo (from their person record). */
  photo_url?: string | null;
}

export interface PartyUnit {
  state_id: number;
  state_name: string;
  eci_recognition: 'National' | 'State' | 'Unrecognised' | null;
  office: string | null;
  website: string | null;
  roles: PartyUnitRole[];
}

/** A candidate's affidavit for one contest (rupees). */
export interface Affidavit {
  age: number | null;
  assets: number | null;
  liabilities: number | null;
  criminal_cases: number | null;
}

/** One entry of constituency_analysis.incumbency.seat_history (runner-up/share absent on rows computed before 2026-10). */
export interface SeatHistoryEntry {
  year: number;
  party: string | null;
  candidate: string;
  margin: number;
  vote_share?: number | null;
  runner_up?: string | null;
  runner_up_party?: string | null;
  /** Won unopposed that year (no runner-up, no margin); set by seatHistory. */
  unopposed?: boolean;
}

export interface PartySummary {
  party_id: string;
  party_name: string;
  color: string;
  won: number;
  leading: number;
}

export interface Constituency {
  id: string;
  election_id: string;
  district_id: number | null;
  district: District | null;
  state_id: number | null;
  state: State | null;
  name: string;
  const_no: number;
  type: 'GEN' | 'SC' | 'ST';
  voter_turnout: number | null;
  phase: number | null;
  total_electors: number | null;
  current_round?: number | null;
  total_rounds?: number | null;
  candidates?: CandidateResult[];
  metadata?: Record<string, unknown>;
  region?: { id: number; name: string } | null;
  last_updated?: string | null;
  /** Live seat state (ingest); sent with the detail by a backend that has it, else absent. */
  seat_state?: SeatLiveState['state'] | null;
}

/** A seat hit from GET /search/constituencies (backend ConstituencySearchHitDto). */
export interface ConstituencySearchHit {
  id: string;
  election_id: string;
  district_id: number | null;
  state_id: number | null;
  name: string;
  const_no: number;
  type: 'GEN' | 'SC' | 'ST';
  voter_turnout: number | null;
  phase: number | null;
  total_electors: number | null;
  current_round: number | null;
  total_rounds: number | null;
  district: { id: number; name: string } | null;
}

export interface Candidate {
  id: string;
  /** Every candidate has a person (migration 018). */
  person_id: string;
  election_id: string;
  const_id: string;
  party_id: string | null;
  party: Party | null;
  name: string;
  is_incumbent: boolean;
}

export interface CandidateResult extends Partial<Affidavit> {
  id: string;
  name: string;
  party: Party | null;
  is_incumbent: boolean;
  votes: number;
  vote_share?: number;
  status: string | null;
  margin: number;
  /** Every candidate has a person (migration 018); optional because not every response carries it. */
  person_id?: string;
  person?: { id: string; photo_url: string | null; wikipedia_url?: string | null } | null;
  isSplitter?: boolean;
}

export interface PersonSummary {
  id: string;
  name: string;
  photo_url: string | null;
  gender: string | null;
  education: string | null;
  date_of_birth: string | null;
  state?: { id: number; name: string } | null;
  district?: { id: number; name: string } | null;
  bio?: string | null;
  wikipedia_url?: string | null;
  /** Credit for a photo we host (image_credits). */
  photo_credit?: PhotoCredit | null;
}

export interface PhotoCredit { source_url: string; author: string | null; licence: string }

/** GET /credits: every hosted image's credit and who shows it. */
export interface ImageCredit extends PhotoCredit { url: string; used_by: string | null }

export interface PersonCandidate extends Partial<Affidavit> {
  id: string;
  name: string;
  party_id: string | null;
  party_name: string | null;
  party_color: string | null;
  party_abbreviation?: string | null;
  party_symbol_url?: string | null;
  party_eci_symbol_url?: string | null;
  election_name: string | null;
  election_year: number | null;
  election_type?: 'LS' | 'VS' | null;
  election_status?: 'Upcoming' | 'Live' | 'Finalized' | null;
  election_id: string;
  constituency_name: string | null;
  const_id: string;
  votes: number;
  vote_share?: number | null;
  status: string | null;
  margin: number;
  is_incumbent: boolean;
}

export interface PersonDetail extends PersonSummary {
  candidates: PersonCandidate[];
}

export interface ResultRow {
  const_id: string;
  party_id: string;
  candidate_name: string;
  votes: number;
  status: string;
  margin: number;
  const_type?: 'GEN' | 'SC' | 'ST';
  /** The candidate's person (snapshots and unversioned rows; matches sitting MLAs and heavyweights). Missing on older backends. */
  person_id?: string | null;
}

export interface SpoilerInfo {
  spoilerParty: string;
  spoilerVotes: number;
  winnerMargin: number;
  hurtsAlliance: string;
}

export interface VoteShare {
  party_id: string;
  party_name: string;
  color: string;
  total_votes: number;
  percentage: number;
}

export interface Alliance {
  party_id: string;
  party_name: string;
  color: string;
  won: number;
  leading: number;
}

export interface PartyStanding {
  id: string;
  name: string;
  color: string;
  won: number;
  leading: number;
  votePct?: number;
  isManifest: boolean;
}

export interface AllianceGroup {
  id: string;
  name: string;
  color: string;
  won: number;
  leading: number;
  votePct: number;
  parties: PartyStanding[];
}

export interface StandingsData {
  groups: AllianceGroup[];
  independents: PartyStanding[];
}

/** GET /elections/:id/manifest. */
export interface Manifest {
  election_id: string;
  /** The PUBLISHED manifest (parsed, history/compare_with limited to comparable elections); the name is historical. */
  draft: ManifestData | null;
}

export interface ManifestLeader {
  name: string;
  party_id: string;
  const_id: string;
  /** The person this entry is (admin picker); seatless leaders link to their person page. */
  person_id?: string;
}

export interface ManifestCabinet {
  name: string;
  role: string;
  party_id: string;
  const_id: string;
  /** The person this entry is (admin picker); seatless leaders link to their person page. */
  person_id?: string;
}

export interface WatchlistEntry {
  name: string;
  party_id: string;
  const_id: string;
  role?: string;
  /** The person this entry is (admin picker); seatless leaders link to their person page. */
  person_id?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  entries: WatchlistEntry[];
}

export interface ManifestData {
  alliances?: ManifestAlliance[];
  leaders?: ManifestLeader[];
  cabinet?: ManifestCabinet[];
  watchlists?: Watchlist[];
  tracked?: string[];
  vip_seats?: Record<string, { label: string; candidate: string }>;
  milestones?: { label: string; value: number }[];
  /** No majority line: the seats are part of a larger assembly (Andhra 2009, undivided state). */
  no_majority?: boolean;
  compare_with?: string[];
  vote_splits?: VoteSplitConfig[];
  history?: string[];
  history_years?: number[];
  geo?: { map_url?: string; hex_url?: string; center?: [number, number]; zoom?: number };
  revision?: {
    label: string;
    data: Record<string, [number, number]>; // const_no → [pre, post]
  };
}

export interface ManifestAlliance {
  id: string;
  name: string;
  color: string;
  parties: string[];
}

export interface VoteSplitConfig {
  spoiler: string;   // Party ID (e.g., "AIMIM")
  hurts: string;     // Alliance ID it damages (e.g., "MGB")
  label: string;     // Display label ("AIMIM split")
}

export interface SwingEntry {
  constId: string;
  currentParty: string;
  prevParty: string;
  currentMargin: number;
  prevMargin: number;
  flipped: boolean;
  /** A split faction now holds the old party's seat (party lineage): not a flip. */
  split?: boolean;
}

/** GET /elections/:id/results?v=<version>: every dashboard tile updates from one snapshot. */
/** Ingest state of one seat (only seats with ingest state appear in a snapshot). */
export interface SeatLiveState {
  state: 'not_started' | 'counting' | 'declared' | 'countermanded' | 'adjourned';
  cr: number | null;
  tr: number | null;
}

export interface ResultsSnapshot {
  version: number;
  results: ResultRow[];
  /** Same shape as /alliances (seat tally per party). */
  summary: Alliance[];
  voteShare: VoteShare[];
  /** Per-seat ingest state keyed by const_id. */
  seats?: Record<string, SeatLiveState>;
  /** Per-seat counting trail (≤6 points); missing on an older backend. */
  trail?: Record<string, SeatTrail>;
}

export interface DominanceEntry {
  constId: string;
  winners: { party: string }[];   // per election, oldest→newest
  classification: 'stronghold' | 'loyal' | 'swing' | 'new';
  dominantParty?: string;
  streak: number;
}

export interface IncumbencyEntry {
  constId: string;
  incumbentName: string;
  incumbentParty: string;
  won: boolean;
  currentMargin: number;
}

export interface PartySwitchEntry {
  constId: string;
  candidateName: string;
  fromParty: string;
  toParty: string;
  fromYear: number;
  toYear: number;
  wonInNewParty: boolean;
  margin: number;
}

export interface MarginTrendPoint {
  year: number;
  avgMargin: number;
  medianMargin: number;
  seats: number;
}

export interface PartyTrendPoint {
  party: string;
  year: number;
  seatsWon: number;
  avgMargin: number;
}

export interface AnalysisEntry {
  id: string;
  const_id: string;
  election_id: string;
  dominance: string | null;
  dominance_party: string | null;
  /** Shared-module SeatAnalysis (migration 024); null until computed, missing on an older backend. */
  data?: SeatAnalysis | null;
  /** Pre-024 JSON, served for one release while a row is not yet recomputed (only its seat history is read). */
  incumbency?: { seat_history?: SeatAnalysis['history'] };
}

export interface ConstituencyAnalysisDetail extends AnalysisEntry {
  notes: string | null;
}

/** GET /parties/:id/record: one row per Finalized VS election the party contested (party page spec §2). */
export interface PartyRecordElection {
  election_id: string; state_id: number; state_code: string; state_name: string; year: number;
  /** Counting day (else mid-year): the lineage comparison window. */
  date: string;
  delimitation: string | null;
  contested: number; won: number; votes: number; share: number;
  held: number; gained: number; lost: number; split_gained: number; split_lost: number;
  seats_total: number; largest: boolean; formed_government: boolean | null;
  /** Lineage-family members (not the party) in the same election: earlier totals across a merger. */
  family: { party_id: string; won: number; share: number }[];
}

/** An election in one of the party's states where it did not run but a lineage relative did. */
export interface PartyRecordFamilyElection {
  election_id: string; state_id: number; year: number; date: string; delimitation: string | null;
  family: { party_id: string; won: number; share: number }[];
}

/** An election held in one of the party's states (contested or not): what "the previous election" means there. */
export interface PartyRecordStateElection { election_id: string; state_id: number; year: number; date: string; delimitation: string | null }

export interface PartyRecordMla { person_id: string | null; name: string; photo_url: string | null; const_id: string; const_name: string; margin: number | null }

export interface PartyRecord {
  party_id: string;
  /** Newest first. */
  elections: PartyRecordElection[];
  /** Missing on an older backend. */
  family_elections?: PartyRecordFamilyElection[];
  /** Missing on an older backend. */
  state_elections?: PartyRecordStateElection[];
  lineage: LineageEvent[];
  /** With `?state=`: that state's latest election. */
  state?: {
    code: string; election_id: string; mlas: PartyRecordMla[];
    flow: { from: string; to: string; seats: number; split: boolean }[];
    regions: { region: string; seats: number; won: number }[] | null;
  };
}
