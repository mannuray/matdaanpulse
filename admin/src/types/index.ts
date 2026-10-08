export interface User {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER';
  name: string;
  created_at?: string;
}

export interface Election {
  id: string;
  name: string;
  type: 'LS' | 'VS';
  state_id: number | null;
  year: number;
  status: 'Upcoming' | 'Live' | 'Finalized';
  tentative_next_date: string | null;
  /** Delimitation order year the seats follow, e.g. "2008"; null = not known. */
  delimitation: string | null;
  manifest_url: string | null;
}

/** Newest audit row of a record, from the admin detail responses. */
export interface LastEdit {
  at: string;
  by: string | null;
}

export type EciRecognition = 'National' | 'State' | 'Unrecognised';

export interface Party {
  id: string;
  name: string;
  color: string | null;
  symbol_url: string | null;
  eci_symbol_url: string | null;
  abbreviation: string | null;
  leader_name: string | null;
  founded_year: number | null;
  headquarters: string | null;
  website: string | null;
  wikipedia_url: string | null;
  description: string | null;
  eci_recognition?: EciRecognition | null;
  updated_at?: string;
  last_edit?: LastEdit | null;
}

/** GET /admin/parties/:id/usage */
export interface PartyUsage {
  totals: { candidates: number; elections: number; wins: number };
  elections: { election_id: string; name: string; type: string; year: number; candidates: number; wins: number }[];
}

export interface Person {
  id: string;
  name: string;
  photo_url: string | null;
  gender: string | null;
  education: string | null;
  date_of_birth: string | null;
  bio?: string | null;
  wikipedia_url?: string | null;
  /** Admin-only identity fields (the public profile never shows them). */
  caste?: string | null;
  religion?: string | null;
  updated_at?: string;
  last_edit?: LastEdit | null;
}

export interface PersonWithStats extends Person {
  candidate_count: number;
  elections: string[];
  state_id: number | null;
  state_name: string | null;
  region_id: number | null;
  region_name: string | null;
}

export interface PersonWithCandidates extends Person {
  candidates: PersonCandidate[];
  /** Merges into this person, newest first (GET /admin/persons/:id); undone ones stay listed with undoable false. */
  merges?: PersonMerge[];
}

/** One merge log row of a person (AdminPersonMergeDto). */
export interface PersonMerge {
  id: string;
  duplicate_name: string;
  candidate_count: number;
  merged_at: string;
  /** The merging user's name; null when unknown. */
  merged_by: string | null;
  /** Not undone yet, and every contest it moved still belongs to this person. */
  undoable: boolean;
  /** When it was undone (ISO); null while it stands. */
  undone_at: string | null;
  /** Why it can't be undone; null when it can. */
  not_undoable_reason: 'undone' | 'contests_moved' | null;
}

/** One contest in a person's election history (GET /admin/persons/:id, newest first). */
export interface PersonCandidate {
  /** The candidate id: the row opens /candidates/:id. */
  id: string;
  name: string;
  party_id: string | null;
  party_name?: string | null;
  party_color?: string | null;
  election_id: string;
  election_name?: string | null;
  election_year?: number | null;
  election_type?: string | null;
  election_status?: Election['status'] | null;
  const_id: string;
  constituency_name?: string | null;
  const_no?: number | null;
  votes?: number;
  /** results.status (WON, LOST, LEADING…); null when the seat has no result row. */
  status?: string | null;
  margin?: number;
  is_incumbent: boolean;
}

export interface Candidate {
  id: string;
  /** Every candidate has a person (migration 018). */
  person_id: string;
  person?: Person | null;
  election_id: string;
  election?: Election;
  const_id: string;
  constituency?: Constituency;
  party_id: string | null;
  party: Party | null;
  /** The name as filed on the ballot (the person's name is the display name). */
  name: string;
  is_incumbent: boolean;
  /** Affidavit for this run: age at nomination; assets and liabilities in rupees. */
  age: number | null;
  assets: number | null;
  liabilities: number | null;
  criminal_cases: number | null;
  updated_at?: string;
  last_edit?: LastEdit | null;
  /** The person's candidacies across elections (detail response only). */
  person_contests?: { contests: number; first_year: number | null } | null;
  /** Only on the change person response: set when moving the person's last contest merged it into the target. */
  merge_id?: string | null;
}

/** One candidate of a seat in GET /admin/candidates/:id/result. */
export interface SeatRow {
  candidate_id: string;
  name: string;
  party_id: string | null;
  votes: number | null;
  /** Percent of all votes in the seat, 1 decimal; null when no votes are recorded. */
  share: number | null;
  position: number | null;
  status: string | null;
  /** The winner's margin; for others the gap to the winner (<= 0); null when unknown. */
  margin: number | null;
}

export interface CandidateResult {
  declared: boolean;
  total_votes: number;
  candidate: SeatRow | null;
  seat: SeatRow[];
}

export interface AuditLog {
  id: string;
  /** null once the acting user is deleted (FK ON DELETE SET NULL); the entry is kept. */
  user_id: string | null;
  /** The acting user, as GET /admin/audit-logs includes it (`include: { users: … }`). */
  users?: Pick<User, 'id' | 'email' | 'name' | 'role'> | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: unknown;
  new_value?: unknown;
  timestamp: string;
}

export type FeedbackKind = 'bug' | 'data_error' | 'suggestion' | 'other';
export type FeedbackStatus = 'new' | 'read' | 'resolved';

/** Public feedback, as returned by GET/PATCH /admin/feedback. */
export interface Feedback {
  id: string;
  kind: FeedbackKind;
  message: string;
  email: string | null;
  page: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

export interface ManifestLeader {
  name: string;
  party_id: string;
  const_id: string;
  /** The person this entry is (picker); seatless leaders link to their person page. */
  person_id?: string;
}

export interface ManifestCabinet {
  name: string;
  role: string;
  party_id: string;
  const_id: string;
  /** The person this entry is (picker); seatless leaders link to their person page. */
  person_id?: string;
}

export interface WatchlistEntry {
  name: string;
  party_id: string;
  const_id: string;
  role?: string;
  /** The person this entry is (picker); seatless leaders link to their person page. */
  person_id?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  entries: WatchlistEntry[];
}

export interface LiveTab {
  label: string;
  const_nos: number[];
}

export interface LiveCandidate {
  result_id: string;
  candidate_id: string;
  candidate_name: string;
  party_id: string;
  party_name: string;
  party_color: string | null;
  party_abbr: string | null;
  votes: number;
  status: string;
  margin: number;
  last_updated: string;
}

export type SeatStateName = 'not_started' | 'counting' | 'declared' | 'countermanded' | 'adjourned';
export interface LiveConstituency {
  const_id: string;
  const_name: string;
  const_no: number;
  const_type: string;
  current_round: number | null;
  total_rounds: number | null;
  seat_state?: SeatStateName | null;
  candidates: LiveCandidate[];
}

export interface SeatLock {
  const_id: string;
  user_id: string;
  user_name: string;
  acquired_at: string;
}

export interface ManifestAlliance {
  id: string;
  name: string;
  color: string;
  parties: string[];
}

export type Alliance = ManifestAlliance;

export interface Milestone {
  label: string;
  value: number;
}

export interface VoteSplitConfig {
  spoiler: string;
  hurts: string;
  label: string;
}

export type VoteSplit = VoteSplitConfig;

export interface ManifestData {
  alliances?: ManifestAlliance[];
  leaders?: ManifestLeader[];
  cabinet?: ManifestCabinet[];
  watchlists?: Watchlist[];
  tracked?: string[];
  vip_seats?: Record<string, { label: string; candidate: string }>;
  milestones?: Milestone[];
  compare_with?: string[];
  history?: string[];
  history_years?: number[];
  vote_splits?: VoteSplitConfig[];
  geo?: { map_url?: string; center?: [number, number]; zoom?: number };
  live_tabs?: LiveTab[];
  revision?: Record<string, unknown>;
}

export interface Manifest {
  election_id: string;
  manifest_url: string | null;
  draft: ManifestData | null;
}

export interface State {
  id: number;
  name: string;
  code: string;
}

export interface Constituency {
  id: string;
  election_id: string;
  name: string;
  const_no: number;
  type: 'GEN' | 'SC' | 'ST';
  state_id: number | null;
  district_id: number | null;
  district?: { id: number; name: string; code: string } | null;
  region_id: number | null;
  region?: { id: number; name: string; code: string } | null;
  /** On the admin detail response only. */
  state?: { id: number; name: string; code: string } | null;
  voter_turnout: number | null;
  phase?: number | null;
  updated_at?: string;
  last_edit?: LastEdit | null;
  metadata: ConstituencyMetadata;
  analysis?: ConstituencyAnalysis | null;
  election?: Election;
}

/** GET /admin/constituencies/:id/history */
export interface ConstituencyHistory {
  volatility: { elections: number; changes: number };
  rows: {
    election_id: string;
    year: number;
    type: string;
    winner: string | null;
    party_id: string | null;
    margin: number | null;
    turnout: number | null;
    is_current: boolean;
  }[];
}

export interface ConstituencyMetadata {
  tags?: string[];
  region?: string;
  [key: string]: unknown;
}

export interface ConstituencyAnalysis {
  id: string;
  const_id: string;
  election_id: string;
  dominance: string | null;
  dominance_party: string | null;
  /** The shared seat-analysis output (migration 024); only the fields the admin card shows. Null until computed. */
  data?: {
    class?: { kind: string; holder: string; streak: number; since: number } | null;
    outcome?: { kind: string; from: string | null } | null;
    incumbent?: { name: string; party: string | null; recontested: boolean; switched: boolean; party_now: string | null } | null;
  } | null;
  notes?: string | null;
  /** When it was last computed (ISO); computed_at from migration 024, else updated_at. */
  computed_at?: string | null;
  updated_at?: string | null;
}

export interface ShardSelector { state_ids?: number[]; region_ids?: number[]; district_ids?: number[]; const_no_ranges?: [number, number][] }
export interface IngestShardStatus { name: string; seat_count: number; source: string | null; lease_holder: string | null; lease_expires_at: string | null; last_post_at: string | null; last_applied_at: string | null; lag_s: number | null; recent: Record<string, number>; rejected: { const_id: string; reason: string }[]; tally_mismatch: { party_id: string }[] | null }
export interface IngestAlert { key: string; level: 'warn' | 'error'; shard: string; message: string }
export interface IngestStatus { election_id: string; status: string; active_source: string | null; hold_minutes: number; shards: IngestShardStatus[]; alerts: IngestAlert[] }
export interface HoldRow { const_id: string; const_no: number; name: string; round_at_hold: number | null; expires_at: string; created_by_name: string | null }
/** `election_id` / `expires_at` are null only on keys created before migration 026 (valid for any election, never expire). */
export interface IngestKeyRow { id: string; name: string; election_id: string | null; expires_at: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null }
