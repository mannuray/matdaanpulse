import { IsBoolean, IsOptional } from 'class-validator';
import { IsUuidLike } from '../../../common/validation/uuid-like';

export class SeatLockQuery {
  @IsUuidLike()
  election_id!: string;
}

export class SeatLockRelease {
  @IsUuidLike()
  election_id!: string;

  @IsUuidLike()
  const_id!: string;
}

export class SeatLockAcquire extends SeatLockRelease {
  @IsOptional()
  @IsBoolean()
  take_over?: boolean;
}
