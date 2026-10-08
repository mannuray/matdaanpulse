import { Expose, Transform, Type } from 'class-transformer';
import { bigintTransform } from '../../../common/util/json-safe';

class PlaceDto {
  @Expose() id: number;
  @Expose() name: string;
}

class DetailPartyDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() abbreviation: string | null;
  @Expose() color: string | null;
  @Expose() symbol_url: string | null;
  @Expose() eci_symbol_url: string | null;
}

class DetailPersonDto {
  @Expose() id: string;
  @Expose() photo_url: string | null;
  @Expose() wikipedia_url: string | null;
}

class DetailCandidateDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() is_incumbent: boolean;
  @Expose() votes: number;
  @Expose() status: string | null;
  @Expose() margin: number;
  @Expose() person_id: string;
  @Expose() @Type(() => DetailPersonDto) person: DetailPersonDto | null;
  @Expose() @Type(() => DetailPartyDto) party: DetailPartyDto | null;
  @Expose() age: number | null;
  @Expose() @Transform(bigintTransform) assets: number | null;
  @Expose() @Transform(bigintTransform) liabilities: number | null;
  @Expose() criminal_cases: number | null;
}

/** Public constituency detail (slow-changing facts; live numbers come from the results snapshot). */
export class ConstituencyDetailDto {
  @Expose() id: string;
  @Expose() election_id: string;
  @Expose() name: string;
  @Expose() const_no: number;
  @Expose() type: 'GEN' | 'SC' | 'ST';
  @Expose() @Transform(({ value }) => (value == null ? null : Number(value))) voter_turnout: number | null;
  @Expose() phase: number | null;
  @Expose() total_electors: number | null;
  @Expose() current_round: number | null;
  @Expose() total_rounds: number | null;
  /** Live seat state from ingest (null before any). */
  @Expose() seat_state: string | null;
  @Expose() @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value ?? null)) last_updated: string | null;
  @Expose() @Type(() => PlaceDto) state: PlaceDto | null;
  @Expose() @Type(() => PlaceDto) district: PlaceDto | null;
  @Expose() @Type(() => PlaceDto) region: PlaceDto | null;
  @Expose() @Type(() => DetailCandidateDto) candidates: DetailCandidateDto[];
}
