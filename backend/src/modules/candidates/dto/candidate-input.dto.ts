import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsUuidLike } from '../../../common/validation/uuid-like';
import { emptyToNull } from '../../../common/validation/dto-helpers';

/** Request-body DTOs (moved out of admin/ so domain services do not depend on the admin module). */

/** SMALLINT columns (age, criminal_cases). */
const SMALLINT_MAX = 32767;

/**
 * Candidacy fields only: identity (gender, education, …) is on the person. The affidavit is typed
 * (migration 018): whole numbers ≥ 0, blank means null; assets and liabilities are rupees, capped so
 * they stay exact as JS numbers.
 */
class CandidateFieldsDto {
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(20)
  party_id?: string | null;

  @IsOptional() @IsBoolean()
  is_incumbent?: boolean;

  @IsOptional() @Transform(emptyToNull) @IsInt() @Min(0) @Max(SMALLINT_MAX)
  age?: number | null;

  @IsOptional() @Transform(emptyToNull) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  assets?: number | null;

  @IsOptional() @Transform(emptyToNull) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  liabilities?: number | null;

  @IsOptional() @Transform(emptyToNull) @IsInt() @Min(0) @Max(SMALLINT_MAX)
  criminal_cases?: number | null;
}

/** No person_id: a candidacy moves to another person through PUT /admin/candidates/:id/person (which audits it). */
export class UpdateCandidateDto extends CandidateFieldsDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255)
  name?: string;
}

export class CreateCandidateDto extends CandidateFieldsDto {
  /** Without one, the candidate gets a new person from its ballot name and the seat's state. */
  @IsOptional() @Transform(emptyToNull) @IsUuidLike()
  person_id?: string | null;

  @IsUuidLike()
  election_id: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  const_id: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;
}

/** PUT /admin/candidates/:id/person (change person); also the body of the older PUT …/link-person. */
export class LinkPersonDto {
  @IsUuidLike()
  person_id: string;
}
