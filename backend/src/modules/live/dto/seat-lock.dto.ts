import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsUuidLike } from '../../../common/validation/uuid-like';

export class SeatLockQuery {
  @IsUuidLike()
  election_id!: string;
}

export class SeatLockRelease {
  @IsUuidLike()
  election_id!: string;

  // Constituency ids are strings like BR_VS_1_VALMIKI_NAGAR (not UUIDs). The charset keeps
  // glob/separator characters (* ? [ ] :) out of the Redis key and SCAN pattern.
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9_&-]+$/)
  const_id!: string;
}

export class SeatLockAcquire extends SeatLockRelease {
  @IsOptional()
  @IsBoolean()
  take_over?: boolean;
}
