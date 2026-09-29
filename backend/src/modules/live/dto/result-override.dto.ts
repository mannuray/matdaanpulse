import {
  IsUUID, IsOptional, IsInt, IsIn, IsString, IsArray, IsNotEmpty,
  ValidateNested, ArrayMaxSize, Min, ValidateBy, ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Ensures the value is a Map (i.e. the body sent a JSON object, not an array/primitive). */
function IsMap(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isMap',
      validator: {
        validate: (value: unknown) => value instanceof Map,
        defaultMessage: () => '$property must be an object keyed by const_id',
      },
    },
    options,
  );
}

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

/**
 * Single item in a bulk override request.
 * `const_id` / `party_id` are still accepted for backward compatibility with
 * existing clients (scraper replay), but are ignored: the server derives both
 * from the result row so a client cannot publish mismatched SSE payloads.
 */
export class BulkOverrideItem {
  @IsUUID()
  result_id: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  const_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  party_id?: string;

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

/**
 * Max overrides per bulk request. Updates are applied with a single
 * UPDATE … FROM UNNEST(...) statement that binds one array per column, so the
 * bind-parameter count is constant; the cap bounds request size / tx duration.
 * ~150 bytes per item → 10k items ≈ 1.5 MB (see JSON body limit in main.ts).
 */
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

  /**
   * Round info keyed by const_id. Sent as a JSON object; class-transformer turns
   * it into a Map (from the design type) so each value is validated as a
   * ConstituencyRoundDto instead of the keys being treated as properties.
   */
  @IsOptional()
  @IsMap()
  @ValidateNested({ each: true })
  @Type(() => ConstituencyRoundDto)
  rounds?: Map<string, ConstituencyRoundDto>;
}
