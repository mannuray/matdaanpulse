import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsUuidLike } from '../../../common/validation/uuid-like';
import { emptyToNull } from '../../../common/validation/dto-helpers';

/** Request-body DTOs (moved out of admin/ so domain services do not depend on the admin module). */

class CandidateFieldsDto {
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(20)
  party_id?: string | null;

  @IsOptional() @IsUuidLike()
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
  @IsUuidLike()
  election_id: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  const_id: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;
}

export class LinkPersonDto {
  @IsUuidLike()
  person_id: string;
}
