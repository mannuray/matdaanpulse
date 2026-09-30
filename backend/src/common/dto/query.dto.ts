import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { election_status, election_type } from '@prisma/client';

/**
 * Query-string DTOs for list endpoints (review E-M2). The global ValidationPipe
 * (transform + whitelist + forbidNonWhitelisted) turns bad input into 400s
 * instead of Prisma 500s, and rejects undeclared params — so every param a SPA
 * sends must be declared here.
 */

export const MAX_PAGE_SIZE = 200;
const MAX_QUERY_LENGTH = 100;

export class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE_SIZE)
  limit?: number;
}

export class ElectionsQueryDto {
  @IsOptional() @IsEnum(election_type)
  type?: election_type;

  @IsOptional() @IsEnum(election_status)
  status?: election_status;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  state_id?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100)
  year?: number;
}

export class ElectionIdQueryDto {
  @IsOptional() @IsUUID()
  election_id?: string;
}

export class CandidatesQueryDto extends ElectionIdQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  const_id?: string;
}

export class SearchQueryDto extends ElectionIdQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  q?: string;
}

export class ConstituencySearchQueryDto extends SearchQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  district_id?: number;
}

export class PartiesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  q?: string;

  @IsOptional() @IsUUID()
  election_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  state_id?: number;
}

export class AdminConstituenciesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  q?: string;
}

export class AdminPersonsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_QUERY_LENGTH)
  q?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  state_id?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  region_id?: number;
}

export class AuditLogsQueryDto {
  @IsOptional() @IsUUID()
  user_id?: string;

  @IsOptional() @IsString() @MaxLength(100)
  action?: string;

  @IsOptional() @IsString() @MaxLength(50)
  entity_type?: string;

  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;
}
