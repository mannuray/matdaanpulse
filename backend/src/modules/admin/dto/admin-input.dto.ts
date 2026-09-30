import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsIn, IsEnum, IsUUID, IsBoolean, IsObject,
  IsArray, IsDateString, MaxLength, Min, Max, ArrayMaxSize, IsUrl,
} from 'class-validator';
import { IsSafeUrl, MAX_URL_LENGTH } from '../../../common/validation/safe-url';
import { Transform } from 'class-transformer';
import { election_status } from '@prisma/client';

/**
 * Request-body DTOs for admin write endpoints. The global ValidationPipe runs
 * with whitelist + forbidNonWhitelisted, so only the fields declared here are
 * accepted; anything else is rejected with 400.
 */

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

/** Absolute http(s) links only (review S-M2): no javascript:/data: URLs in stored hrefs. */
const HTTP_URL = { protocols: ['http', 'https'], require_protocol: true };

// --- Elections ---

export class CreateElectionDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  @IsIn(['LS', 'VS'])
  type: 'LS' | 'VS';

  @IsInt() @Min(1947) @Max(2100)
  year: number;

  @IsOptional() @IsInt()
  state_id?: number | null;

  @IsOptional() @Transform(emptyToNull) @IsDateString()
  tentative_next_date?: string | null;

  @IsOptional() @IsEnum(election_status)
  status?: election_status;
}

export class UpdateElectionDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255)
  name?: string;

  @IsOptional() @IsIn(['LS', 'VS'])
  type?: 'LS' | 'VS';

  @IsOptional() @IsInt() @Min(1947) @Max(2100)
  year?: number;

  @IsOptional() @IsInt()
  state_id?: number | null;

  @IsOptional() @Transform(emptyToNull) @IsDateString()
  tentative_next_date?: string | null;

  @IsOptional() @IsEnum(election_status)
  status?: election_status;
}

// --- Parties ---

class PartyFieldsDto {
  @IsOptional() @IsString() @MaxLength(10)
  color?: string | null;

  /** Seeded values are site-relative (/symbols/logos/X.svg), so paths are allowed here. */
  @IsOptional() @Transform(emptyToNull) @IsString() @IsSafeUrl({ allowRelative: true })
  symbol_url?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @IsSafeUrl({ allowRelative: true })
  eci_symbol_url?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  abbreviation?: string | null;

  @IsOptional() @IsString() @MaxLength(255)
  leader_name?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsInt() @Min(1800) @Max(2100)
  founded_year?: number | null;

  @IsOptional() @IsString() @MaxLength(255)
  headquarters?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsUrl(HTTP_URL) @MaxLength(MAX_URL_LENGTH)
  website?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsUrl(HTTP_URL) @MaxLength(MAX_URL_LENGTH)
  wikipedia_url?: string | null;

  @IsOptional() @IsString()
  description?: string | null;
}

export class UpdatePartyDto extends PartyFieldsDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255)
  name?: string;
}

export class CreatePartyDto extends PartyFieldsDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  id: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;
}

// --- Candidates ---

class CandidateFieldsDto {
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(20)
  party_id?: string | null;

  @IsOptional() @IsUUID()
  person_id?: string | null;

  @IsOptional() @IsBoolean()
  is_incumbent?: boolean;

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCandidateDto extends CandidateFieldsDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255)
  name?: string;
}

export class CreateCandidateDto extends CandidateFieldsDto {
  @IsUUID()
  election_id: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  const_id: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;
}

export class EnrichCandidatesDto {
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @IsUUID('all', { each: true })
  candidate_ids?: string[];
}

export class LinkPersonDto {
  @IsUUID()
  person_id: string;
}

// --- Persons ---

class PersonFieldsDto {
  @IsOptional() @Transform(emptyToNull) @IsUrl(HTTP_URL) @MaxLength(MAX_URL_LENGTH)
  photo_url?: string | null;

  @IsOptional() @IsString() @MaxLength(10)
  gender?: string | null;

  @IsOptional() @IsString() @MaxLength(255)
  education?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsDateString()
  date_of_birth?: string | null;

  @IsOptional() @IsInt()
  state_id?: number | null;

  @IsOptional() @IsInt()
  region_id?: number | null;

  @IsOptional() @IsInt()
  district_id?: number | null;

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;

  /** Stored in metadata.bio (no dedicated column). */
  @IsOptional() @IsString()
  bio?: string | null;

  /** Stored in metadata.wikipedia_url (no dedicated column). */
  @IsOptional() @Transform(emptyToNull) @IsUrl(HTTP_URL) @MaxLength(MAX_URL_LENGTH)
  wikipedia_url?: string | null;
}

export class UpdatePersonDto extends PersonFieldsDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255)
  name?: string;
}

export class CreatePersonDto extends PersonFieldsDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;
}

export class MergePersonsDto {
  @IsUUID()
  source_id: string;

  @IsUUID()
  target_id: string;
}

export class EnrichPersonsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsUUID('all', { each: true })
  person_ids?: string[];
}

// --- Constituencies / analysis ---

export class UpdateConstituencyDto {
  @IsOptional() @IsInt()
  district_id?: number | null;

  @IsOptional() @IsInt()
  region_id?: number | null;

  @IsOptional() @IsInt() @Min(1)
  const_no?: number;

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class BulkTagDto {
  @IsArray() @ArrayMaxSize(5000) @IsString({ each: true })
  ids: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true })
  add_tags?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true })
  remove_tags?: string[];
}

export class ComputeAnalysisDto {
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true })
  history_election_ids?: string[];

  @IsOptional() @IsObject()
  manifest?: Record<string, unknown>;
}

export class UpdateAnalysisDto {
  @IsOptional() @IsString() @MaxLength(20)
  dominance?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  dominance_party?: string | null;

  @IsOptional() @IsObject()
  incumbency?: Record<string, unknown>;

  @IsOptional() @IsString()
  ai_briefing?: string | null;

  @IsOptional() @IsObject()
  ai_demographics?: Record<string, unknown> | null;

  @IsOptional() @IsArray() @IsString({ each: true })
  ai_key_issues?: string[];

  @IsOptional() @IsString() @MaxLength(20)
  ai_status?: string | null;

  @IsOptional() @IsString()
  notes?: string | null;
}

export class BulkAiStatusDto {
  @IsArray() @ArrayMaxSize(5000) @IsUUID('all', { each: true })
  ids: string[];

  @IsString() @IsNotEmpty() @MaxLength(20)
  status: string;
}

export class EnrichConstituenciesDto {
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @IsString({ each: true })
  const_ids?: string[];

  @IsOptional() @IsIn(['pre_poll', 'post_poll'])
  mode?: 'pre_poll' | 'post_poll';
}
