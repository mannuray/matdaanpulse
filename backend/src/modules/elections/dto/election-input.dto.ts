import { IsString, IsNotEmpty, IsOptional, IsInt, IsIn, IsEnum, IsDateString, MaxLength, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { election_status } from '@prisma/client';
import { emptyToNull } from '../../../common/validation/dto-helpers';

/** Request-body DTOs (moved out of admin/ so domain services do not depend on the admin module). */

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
