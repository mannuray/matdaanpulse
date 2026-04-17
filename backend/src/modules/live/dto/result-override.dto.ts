import {
  IsUUID, IsOptional, IsInt, IsIn, IsString, IsArray, IsNotEmpty,
  ValidateNested, ArrayMaxSize, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_STATUSES = ['LEADING', 'WON', 'TRAILING', 'LOST'] as const;

/** Constituency-level round tracking, sent alongside result overrides. */
export class ConstituencyRoundDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  current_round?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  total_rounds?: number;
}

/** Combined payload accepted by the single override endpoint. */
export class OverridePayload extends ConstituencyRoundDto {
  @IsUUID()
  result_id: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  votes?: number;

  @IsOptional()
  @IsIn(VALID_STATUSES)
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  margin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  round_no?: number;
}

/** Single item in a bulk override request. */
export class BulkOverrideItem {
  @IsUUID()
  result_id: string;

  @IsString()
  @IsNotEmpty()
  const_id: string;

  @IsString()
  @IsNotEmpty()
  party_id: string;

  @IsInt()
  @Min(0)
  votes: number;

  @IsIn(VALID_STATUSES)
  status: string;

  @IsInt()
  @Min(0)
  margin: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  round_no?: number;
}

/** Max overrides per bulk request (PG supports 65535 params; 5 per item → ~13000 cap). */
export const MAX_BULK_OVERRIDES = 10_000;

/** Bulk override payload — one request per round batch. */
export class BulkOverridePayload {
  @IsUUID()
  election_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(MAX_BULK_OVERRIDES)
  @Type(() => BulkOverrideItem)
  overrides: BulkOverrideItem[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ConstituencyRoundDto)
  rounds?: Record<string, ConstituencyRoundDto>;
}
