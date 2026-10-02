import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsUuidLike } from '../validation/uuid-like';
import { election_status, election_type } from '@prisma/client';
import { ECI_RECOGNITIONS, type EciRecognitionFilter } from '../../modules/parties/dto/party-input.dto';

/**
 * Query-string DTOs for list endpoints (review E-M2). The global ValidationPipe
 * (transform + whitelist + forbidNonWhitelisted) turns bad input into 400s
 * instead of Prisma 500s, and rejects undeclared params — so every param a SPA
 * sends must be declared here.
 */

export const MAX_PAGE_SIZE = 200;

// An empty param (`?election_id=`) means "not sent", as the old controllers
// treated it; @IsOptional alone only skips null/undefined.
const EmptyAsUndefined = () => Transform(({ value }) => (value === '' ? undefined : value));
const OptionalNumber = () =>
  Transform(({ value }) => (value === '' || value === undefined || value === null ? undefined : Number(value)));
const MAX_QUERY_LENGTH = 100;

export class PaginationQueryDto {
  @IsOptional() @OptionalNumber() @IsInt() @Min(1) @Max(100_000)
  page?: number;

  @IsOptional() @OptionalNumber() @IsInt() @Min(1) @Max(MAX_PAGE_SIZE)
  limit?: number;
}

export class ElectionsQueryDto {
  @IsOptional() @EmptyAsUndefined() @IsEnum(election_type)
  type?: election_type;

  @IsOptional() @EmptyAsUndefined() @IsEnum(election_status)
  status?: election_status;

  @IsOptional() @OptionalNumber() @IsInt() @Min(1)
  state_id?: number;

  @IsOptional() @OptionalNumber() @IsInt() @Min(1900) @Max(2100)
  year?: number;
}

export class ElectionIdQueryDto {
  @IsOptional() @EmptyAsUndefined() @IsUuidLike()
  election_id?: string;
}

export class CandidatesQueryDto extends ElectionIdQueryDto {
  @IsOptional() @EmptyAsUndefined() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  const_id?: string;
}

export class SearchQueryDto extends ElectionIdQueryDto {
  @IsOptional() @EmptyAsUndefined() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  q?: string;
}

export class ConstituencySearchQueryDto extends SearchQueryDto {
  @IsOptional() @OptionalNumber() @IsInt() @Min(1)
  district_id?: number;
}

export class PartiesQueryDto extends PaginationQueryDto {
  @IsOptional() @EmptyAsUndefined() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  q?: string;

  @IsOptional() @EmptyAsUndefined() @IsUuidLike()
  election_id?: string;

  @IsOptional() @OptionalNumber() @IsInt() @Min(1)
  state_id?: number;

  /** A recognition value, or `none` for parties with none set. */
  @IsOptional() @EmptyAsUndefined() @IsIn([...ECI_RECOGNITIONS, 'none'])
  eci_recognition?: EciRecognitionFilter;
}

export class AdminConstituenciesQueryDto extends PaginationQueryDto {
  @IsOptional() @EmptyAsUndefined() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  q?: string;
}

export class AdminPersonsQueryDto extends PaginationQueryDto {
  @IsOptional() @EmptyAsUndefined() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  q?: string;

  @IsOptional() @OptionalNumber() @IsInt() @Min(1)
  state_id?: number;

  @IsOptional() @OptionalNumber() @IsInt() @Min(1)
  region_id?: number;

  /** Number of candidacies: exactly one, or two and more. */
  @IsOptional() @EmptyAsUndefined() @IsIn(['1', '2plus'])
  contests?: '1' | '2plus';
}

export class AuditLogsQueryDto {
  @IsOptional() @EmptyAsUndefined() @IsUuidLike()
  user_id?: string;

  @IsOptional() @EmptyAsUndefined() @IsString() @MaxLength(100)
  action?: string;

  @IsOptional() @EmptyAsUndefined() @IsString() @MaxLength(50)
  entity_type?: string;

  @IsOptional() @EmptyAsUndefined() @IsISO8601()
  from?: string;

  @IsOptional() @EmptyAsUndefined() @IsISO8601()
  to?: string;
}

export const FEEDBACK_STATUSES = ['new', 'read', 'resolved'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export class AdminFeedbackQueryDto extends PaginationQueryDto {
  @IsOptional() @EmptyAsUndefined() @IsIn(FEEDBACK_STATUSES)
  status?: FeedbackStatus;
}

/** GET /elections/:id/results?v=<version> — a live version from GET /elections/:id/live. */
export class ResultsQueryDto {
  @IsOptional() @OptionalNumber() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  v?: number;
}
