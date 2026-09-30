import { IsString, IsNotEmpty, IsOptional, IsInt, IsObject, IsDateString, MaxLength, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsUuidLike } from '../../../common/validation/uuid-like';
import { MAX_URL_LENGTH } from '../../../common/validation/safe-url';
import { emptyToNull, HTTP_URL } from '../../../common/validation/dto-helpers';

/** Request-body DTOs (moved out of admin/ so domain services do not depend on the admin module). */

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
  @IsUuidLike()
  source_id: string;

  @IsUuidLike()
  target_id: string;
}
