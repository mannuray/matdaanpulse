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
  manifest_url: string | null;
  summary?: PartySummary[];
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
}

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

export interface Manifest {
  election_id: string;
  manifest_url: string | null;
  draft: ManifestData | null;
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

export interface ManifestData {
  alliances?: ManifestAlliance[];
  leaders?: ManifestLeader[];
  cabinet?: ManifestCabinet[];
  watchlists?: Watchlist[];
  tracked?: string[];
  vip_seats?: Record<string, { label: string; candidate: string }>;
  milestones?: { label: string; value: number }[];
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

export type MapTab = 'overview' | 'battle' | 'demographics' | 'states' | 'swing' | 'insights' | 'history';

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
}

/** GET /elections/:id/results?v=<version>: every dashboard tile updates from one snapshot. */
export interface ResultsSnapshot {
  version: number;
  results: ResultRow[];
  /** Same shape as /alliances (seat tally per party). */
  summary: Alliance[];
  voteShare: VoteShare[];
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
  incumbency: Record<string, unknown>;
}

export interface ConstituencyAnalysisDetail extends AnalysisEntry {
  notes: string | null;
}
