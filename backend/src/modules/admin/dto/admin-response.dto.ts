import { Expose, Type, Transform } from 'class-transformer';

// --- Shared / Dependency DTOs ---

const toIso = ({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value);

/** Newest audit row of the record (AuditLogService.lastEdit); null when never edited in the admin. */
export class AdminLastEditDto {
  @Expose() at: string;
  @Expose() by: string | null;
}

export class AdminAnalysisDto {
  @Expose() id: string;
  @Expose() dominance: string;
  @Expose() dominance_party: string | null;
  @Expose() incumbency: any;
}

export class AdminPartyDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() color: string;
  @Expose() abbreviation: string | null;
  @Expose() symbol_url: string | null;
  @Expose() eci_symbol_url: string | null;
  @Expose() leader_name: string | null;
  @Expose() founded_year: number | null;
  @Expose() headquarters: string | null;
  @Expose() website: string | null;
  @Expose() wikipedia_url: string | null;
  @Expose() description: string | null;
  @Expose() eci_recognition: 'National' | 'State' | 'Unrecognised' | null;
  @Expose() candidate_count?: number;
  @Expose() @Transform(toIso) updated_at?: string;
  @Expose() @Type(() => AdminLastEditDto) last_edit?: AdminLastEditDto | null;
}

export class AdminConstituencyDto {
  @Expose() id: string;
  @Expose() election_id: string;
  @Expose() name: string;
  @Expose() const_no: number;
  @Expose() type: string;
  @Expose() state_id: number;
  @Expose() district_id: number | null;
  @Expose() region_id: number | null;
  @Expose() current_round: number | null;
  @Expose() total_rounds: number | null;
  @Expose() total_electors: number | null;
  @Expose() voter_turnout: number | null;
  @Expose() phase: number | null;
  @Expose() metadata: any;
  @Expose() @Transform(toIso) updated_at?: string;
  @Expose() @Type(() => AdminLastEditDto) last_edit?: AdminLastEditDto | null;

  @Expose()
  @Type(() => AdminAnalysisDto)
  analysis?: AdminAnalysisDto;

  @Expose()
  district?: any;

  @Expose()
  region?: any;

  @Expose()
  election?: any;
}

// --- Main Entity DTOs (using lazy arrow functions for @Type to avoid circular ReferenceErrors) ---

export class AdminCandidateDto {
  @Expose() id: string;
  @Expose() person_id: string | null;
  @Expose() election_id: string;
  @Expose() const_id: string;
  @Expose() party_id: string | null;
  @Expose() name: string;
  @Expose() is_incumbent: boolean;
  @Expose() metadata: any;
  @Expose() manifest?: any;
  @Expose() @Transform(toIso) updated_at?: string;
  @Expose() @Type(() => AdminLastEditDto) last_edit?: AdminLastEditDto | null;

  @Expose()
  @Type(() => AdminPartyDto)
  parties?: AdminPartyDto;

  @Expose()
  @Type(() => AdminConstituencyDto)
  constituencies?: AdminConstituencyDto;
  
  @Expose()
  @Type(() => AdminPersonDto)
  persons?: any;
}

/** One contest in a person's election history (GET /admin/persons/:id), as PersonsService.findWithCandidates maps it. */
export class AdminPersonContestDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() party_id: string | null;
  @Expose() party_name: string | null;
  @Expose() party_color: string | null;
  @Expose() election_id: string;
  @Expose() election_name: string | null;
  @Expose() election_year: number | null;
  @Expose() election_type: string | null;
  @Expose() election_status: string | null;
  @Expose() const_id: string;
  @Expose() constituency_name: string | null;
  @Expose() const_no: number | null;
  @Expose() votes: number;
  @Expose() status: string | null;
  @Expose() margin: number;
  @Expose() is_incumbent: boolean;
}

export class AdminPersonDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() photo_url: string | null;
  @Expose() gender: string | null;
  @Expose() education: string | null;
  /** No `bio` column: resolved from metadata.bio. */
  @Expose()
  @Transform(({ obj }) => obj.bio ?? obj.metadata?.bio ?? null)
  bio: string | null;

  @Expose() 
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  date_of_birth: Date | null;
  
  @Expose() state_id: number | null;
  @Expose() region_id: number | null;
  @Expose() metadata: any;
  @Expose() @Transform(toIso) updated_at?: string;
  @Expose() @Type(() => AdminLastEditDto) last_edit?: AdminLastEditDto | null;

  @Expose() state_name?: string;
  @Expose() region_name?: string;
  @Expose() candidate_count?: number;
  @Expose() elections?: string[];
  
  @Expose()
  @Type(() => AdminPersonContestDto)
  candidates?: AdminPersonContestDto[];
}

export class AdminUserDto {
  @Expose() id: string;
  @Expose() email: string;
  @Expose() name: string;
  @Expose() role: string;
  
  @Expose() 
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  created_at: Date;
}

// --- Derived read models for the record pages' right-hand cards ---

export class AdminPartyUsageTotalsDto {
  @Expose() candidates: number;
  @Expose() elections: number;
  @Expose() wins: number;
}

export class AdminPartyUsageElectionDto {
  @Expose() election_id: string;
  @Expose() name: string;
  @Expose() type: 'LS' | 'VS';
  @Expose() year: number;
  @Expose() candidates: number;
  @Expose() wins: number;
}

/** GET /admin/parties/:id/usage */
export class AdminPartyUsageDto {
  @Expose() @Type(() => AdminPartyUsageTotalsDto) totals: AdminPartyUsageTotalsDto;
  @Expose() @Type(() => AdminPartyUsageElectionDto) elections: AdminPartyUsageElectionDto[];
}

export class AdminSeatRowDto {
  @Expose() candidate_id: string;
  @Expose() name: string;
  @Expose() party_id: string | null;
  @Expose() votes: number | null;
  @Expose() share: number | null;
  @Expose() position: number | null;
  @Expose() status: string | null;
  @Expose() margin: number | null;
}

/** GET /admin/candidates/:id/result */
export class AdminCandidateResultDto {
  @Expose() declared: boolean;
  @Expose() total_votes: number;
  @Expose() @Type(() => AdminSeatRowDto) candidate: AdminSeatRowDto | null;
  @Expose() @Type(() => AdminSeatRowDto) seat: AdminSeatRowDto[];
}

export class AdminSeatVolatilityDto {
  @Expose() elections: number;
  @Expose() changes: number;
}

export class AdminSeatHistoryRowDto {
  @Expose() election_id: string;
  @Expose() year: number;
  @Expose() type: 'LS' | 'VS';
  @Expose() winner: string | null;
  @Expose() party_id: string | null;
  @Expose() margin: number | null;
  @Expose() turnout: number | null;
  @Expose() is_current: boolean;
}

/** GET /admin/constituencies/:id/history */
export class AdminSeatHistoryDto {
  @Expose() @Type(() => AdminSeatVolatilityDto) volatility: AdminSeatVolatilityDto;
  @Expose() @Type(() => AdminSeatHistoryRowDto) rows: AdminSeatHistoryRowDto[];
}
