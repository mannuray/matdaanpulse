/** An election year; valid years are listed in elections.ts. */
export type Year = number;
export type SeatType = 'GEN' | 'SC' | 'ST';
export type Sex = 'M' | 'F' | 'O';
export type Recognition = 'National' | 'State' | 'Unrecognised';

export interface RawCandidate { serial: number; name: string; sex: Sex | null; age: number | null; party: string; general: number; postal: number; total: number }
/** One seat from Detailed Results. `party` values are that year's ECI abbreviations. NOTA is kept out of candidates. */
export interface RawSeat { constNo: number; acName: string; type: SeatType | null; electors: number; candidates: RawCandidate[]; nota: number | null; totalVotes: number;
  /** Built from its summary: a seat won unopposed that Detailed Results (and the party performance table) leave out. */
  fromSummary?: true }
export interface SummaryPick { party: string; name: string; votes: number }
/** One seat from Constituency Data Summary. `winner.party` is a full name (XLS) or an abbreviation (PDF). */
export interface SeatSummary { constNo: number; name: string; type: SeatType; electors: number; voters: number; contested: number; totalValid: number; nota: number | null; pollDate: string; winner: SummaryPick; runnerUp: SummaryPick | null; margin: number;
  /** Won unopposed: no poll, the winner is the only candidate, 0 votes, no runner-up. */
  uncontested?: true }
export interface PartyListEntry { abbr: string; name: string; recognition: Recognition }
export interface PartyPerformance { abbr: string; contested: number; won: number; votes: number }
export interface RawElection { year: Year; seats: RawSeat[]; summaries: SeatSummary[]; parties: PartyListEntry[]; performance: PartyPerformance[] }

/** Our party row, as seeded. */
export interface PartyEntry { id: string; name: string; abbreviation: string | null; color: string; recognition: Recognition | null }
/** party-map.json: normName(ECI full name) → our party. */
export type PartyMap = Record<string, PartyEntry>;

export interface CandidateJson { serial: number; name: string; partyId: string; sex: Sex | null; age: number | null; votes: number; status: 'WON' | 'LOST' }
export interface SeatJson { constNo: number; /** Only for a new election (no old seed to take names from). */ name?: string; type: SeatType; electors: number;
  /** NULL for a seat won unopposed (no poll). */ voters: number | null; turnout: number | null; phase: number; pollDate: string; candidates: CandidateJson[];
  /** Won unopposed: one candidate, WON, 0 votes, no NOTA row. */ uncontested?: true }
export interface ElectionJson { year: Year; electionId: string; source: { title: string; url: string; retrieved: string }; parties: PartyEntry[]; seats: SeatJson[] }
