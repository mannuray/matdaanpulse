import { Expose, Type } from 'class-transformer';

export class ConstituencySummaryDto {
  @Expose() id: string;
  @Expose() election_id: string;
  @Expose() name: string;
  @Expose() const_no: number;
  @Expose() type: string;
  /** NUMERIC(5,2): a Prisma Decimal, which class-transformer cannot copy as an object (DecimalError); typed as Number. */
  @Expose() @Type(() => Number) voter_turnout: number | null;
  @Expose() phase: number | null;
  @Expose() current_round: number | null;
  @Expose() total_rounds: number | null;
}

export class DistrictRefDto {
  @Expose() id: number;
  @Expose() name: string;
}

/** A seat hit from GET /search/constituencies: the public summary plus its district (no metadata/updated_at/region_id). */
export class ConstituencySearchHitDto extends ConstituencySummaryDto {
  @Expose() district_id: number | null;
  @Expose() state_id: number | null;
  @Expose() total_electors: number | null;
  /** Populated from the Prisma `districts` relation. */
  @Expose({ name: 'districts' })
  @Type(() => DistrictRefDto)
  district: DistrictRefDto | null;
}
