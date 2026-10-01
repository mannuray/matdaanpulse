import { IsString, IsNotEmpty, IsOptional, IsInt, MaxLength, Min, Max, IsUrl, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsSafeUrl, MAX_URL_LENGTH } from '../../../common/validation/safe-url';
import { emptyToNull, HTTP_URL } from '../../../common/validation/dto-helpers';

/** Request-body DTOs (moved out of admin/ so domain services do not depend on the admin module). */

/** `parties.eci_recognition` values (CHECK constraint, migration 017); NULL = not set. */
export const ECI_RECOGNITIONS = ['National', 'State', 'Unrecognised'] as const;
export type EciRecognition = (typeof ECI_RECOGNITIONS)[number];
/** List filter: a recognition value, or `none` for NULL. */
export type EciRecognitionFilter = EciRecognition | 'none';

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

  /** null clears it (not set). */
  @IsOptional() @Transform(emptyToNull) @IsIn(ECI_RECOGNITIONS)
  eci_recognition?: EciRecognition | null;
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
