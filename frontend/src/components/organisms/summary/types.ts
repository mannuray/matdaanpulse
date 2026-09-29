import type { MapTab, SwingEntry, ResultRow, VoteSplitConfig, StandingsData, DominanceEntry, IncumbencyEntry, PartySwitchEntry, MarginTrendPoint, PartyTrendPoint } from '../../../types';

export interface Region {
  id: string;
  name: string;
  /** Geo `st_name` of the constituency, when known (LS). */
  state?: string;
  party?: string;
  partyColor?: string;
  /** Leader's margin; undefined when the seat has no leader yet. */
  margin?: number;
  /** WON | LEADING | PENDING */
  status?: string;
  type?: 'GEN' | 'SC' | 'ST';
  candidate?: string;
}

export interface AllianceDef {
  id: string;
  name: string;
  color: string;
  parties: string[];
}

export interface PartyDef {
  id: string;
  name: string;
  color: string;
  seats: number;
}

export interface ElectionSummaryProps {
  regions: Region[];
  electionType?: 'LS' | 'VS';
  mapTab?: MapTab;
  selectedIds?: Set<string>;
  alliances?: AllianceDef[];
  partyList?: PartyDef[];
  swingMap?: Map<string, SwingEntry>;
  constCandidates?: Map<string, ResultRow[]>;
  voteSplits?: VoteSplitConfig[];
  standings?: StandingsData;
  dominanceMap?: Map<string, DominanceEntry>;
  incumbencyData?: IncumbencyEntry[];
  partySwitchData?: PartySwitchEntry[];
  marginTrend?: MarginTrendPoint[];
  partyTrend?: PartyTrendPoint[];
  spoilerFilter?: string | null;
  onSpoilerFilterChange?: (id: string | null) => void;
  onRegionClick?: (id: string) => void;
}

/** Translation function — loosely typed to accept i18next's TFunction */
export type TFunc = (key: string, defaultValue?: string) => string;

export type { MapTab, SwingEntry, ResultRow, VoteSplitConfig, StandingsData, DominanceEntry, IncumbencyEntry, PartySwitchEntry, MarginTrendPoint, PartyTrendPoint };
