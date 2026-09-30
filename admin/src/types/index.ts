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

/** Candidacy row as returned in a person's election history. */
export interface PersonCandidate extends Candidate {
  constituency_name?: string;
  election_name?: string;
  election_year?: number;
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
}

export interface AuditLog {
  id: string;
  user_id: string;
  user?: User;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: unknown;
  new_value?: unknown;
  timestamp: string;
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
  candidates: LiveCandidate[];
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
  voter_turnout: number | null;
  metadata: ConstituencyMetadata;
  analysis?: ConstituencyAnalysis | null;
  election?: Election;
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
  };
  notes: string | null;
}

export interface ResultOverride {
  const_id: string;
  candidate_id: string;
  votes: number;
  margin: number;
  status: 'LEADING' | 'WON' | 'TRAILING' | 'LOST';
  reason: string;
}
