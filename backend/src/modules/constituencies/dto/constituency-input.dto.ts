import { IsString, IsOptional, IsInt, IsObject, IsArray, MaxLength, Min, ArrayMaxSize } from 'class-validator';
import { IsUuidLike } from '../../../common/validation/uuid-like';
import { MAX_IDS_PER_REQUEST } from '../../../common/validation/dto-helpers';

/** Request-body DTOs (moved out of admin/ so domain services do not depend on the admin module). */

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
  @IsArray() @ArrayMaxSize(MAX_IDS_PER_REQUEST) @IsString({ each: true })
  ids: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true })
  add_tags?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true })
  remove_tags?: string[];
}

export class ComputeAnalysisDto {
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUuidLike({ each: true })
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
  notes?: string | null;
}
