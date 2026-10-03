import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { SEAT_STATES, type SeatState } from '../seat-rules';

const SHARD = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const MAX_SEATS_PER_REQUEST = 500;

export class RoundDto {
  @IsInt() @Min(0) current: number;
  @IsInt() @Min(0) total: number;
}
export class SeatDto {
  @IsString() @MaxLength(100) const_id: string;
  @IsIn(SEAT_STATES as unknown as string[]) state: SeatState;
  @IsOptional() @ValidateNested() @Type(() => RoundDto) round?: RoundDto | null;
  /** candidate_id → votes; keys and values are checked by the seat rules (a bad seat is rejected, not the request). */
  @IsObject() votes: Record<string, number>;
}
export class SeatsBody {
  @Matches(SHARD) shard: string;
  @IsString() @MaxLength(40) source: string;
  @IsString() @MaxLength(80) holder: string;
  @IsISO8601({ strict: true }) observed_at: string;
  @IsOptional() @IsBoolean() dry_run?: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_SEATS_PER_REQUEST) @ValidateNested({ each: true }) @Type(() => SeatDto) seats: SeatDto[];
}
export class LeaseBody {
  @Matches(SHARD) shard: string;
  @IsString() @MaxLength(80) holder: string;
}

export class TallyPartyDto {
  @IsString() @MaxLength(20) party_id: string;
  @IsInt() @Min(0) won: number;
  @IsInt() @Min(0) leading: number;
}
export class TallyBody {
  @Matches(SHARD) shard: string;
  @IsString() @MaxLength(40) source: string;
  @IsString() @MaxLength(80) holder: string;
  @IsISO8601({ strict: true }) observed_at: string;
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => TallyPartyDto) parties: TallyPartyDto[];
}
