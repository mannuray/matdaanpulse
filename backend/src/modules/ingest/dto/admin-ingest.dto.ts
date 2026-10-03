import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateBy, ValidateNested } from 'class-validator';
import { SEAT_STATES, type SeatState } from '../seat-rules';
import { RoundDto } from './ingest.dto';

/** Every element is an [a, b] pair of integers with 1 <= a <= b. */
const IsRangePairs = () => ValidateBy({
  name: 'isRangePairs',
  validator: {
    validate: (v: unknown) => Array.isArray(v) && v.every(p => Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 1 && p[0] <= p[1]),
    defaultMessage: () => 'const_no_ranges must be [from, to] integer pairs with 1 <= from <= to',
  },
});

export class FeedSettingsBody {
  @IsOptional() @IsString() @MaxLength(40) @Matches(/^[a-z0-9][a-z0-9_-]*$/) active_source: string | null;
  @IsInt() @Min(1) @Max(240) hold_minutes: number;
}
export class ShardSelectorDto {
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) state_ids?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsInt({ each: true }) region_ids?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsInt({ each: true }) district_ids?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsRangePairs() const_no_ranges?: [number, number][];
}
export class ShardBody {
  @ValidateNested() @Type(() => ShardSelectorDto) selector: ShardSelectorDto;
  @IsOptional() @IsString() @MaxLength(40) @Matches(/^[a-z0-9][a-z0-9_-]*$/) source_override: string | null;
}
export class SeatCorrectionBody {
  @IsIn(SEAT_STATES as unknown as string[]) state: SeatState;
  @IsOptional() @ValidateNested() @Type(() => RoundDto) round?: RoundDto | null;
  @IsObject() votes: Record<string, number>;
}
export class IngestKeyBody {
  @IsString() @Matches(/^[A-Za-z0-9 _-]{2,80}$/) name: string;
}
