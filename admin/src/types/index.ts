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
  metadata?: Record<string, unknown>;
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
  person_id: string | null;
  person?: Person | null;
  election_id: string;
  election?: Election;
  const_id: string;
  constituency?: Constituency;
  party_id: string | null;
  party: Party | null;
  name: string;
  is_incumbent: boolean;
  metadata?: Record<string, unknown>;
  updated_at?: string;
  last_edit?: LastEdit | null;
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
}

export interface ManifestCabinet {
  name: string;
  role: string;
  party_id: string;
  const_id: string;
}

export interface WatchlistEntry {
  name: string;
  party_id: string;
  const_id: string;
  role?: string;
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

export interface LiveConstituency {
  const_id: string;
  const_name: string;
  const_no: number;
  const_type: string;
  current_round: number | null;
  total_rounds: number | null;
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
  incumbency: {
    incumbent_name?: string;
    incumbent_party?: string;
    re_contesting?: boolean;
    switched_to?: string;
  } | null;
  notes?: string | null;
  /** When it was last computed (ISO). */
  updated_at?: string | null;
}

export interface ResultOverride {
  const_id: string;
  candidate_id: string;
  votes: number;
  margin: number;
  status: 'LEADING' | 'WON' | 'TRAILING' | 'LOST';
  reason: string;
}
