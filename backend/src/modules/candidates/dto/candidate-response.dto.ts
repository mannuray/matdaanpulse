import { Expose, Type, Transform } from 'class-transformer';
import { bigintTransform } from '../../../common/util/json-safe';

export class PlaceMiniDto {
  @Expose() id: number;
  @Expose() name: string;
}

export class PartyMiniDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() color: string;
  @Expose() abbreviation: string | null;
}

export class CandidateSummaryDto {
  @Expose() id: string;
  @Expose() name: string;
  /** The candidate's person (always set since migration 018; the public profile is /candidates/persons/:id). */
  @Expose() person_id: string;
  @Expose() party_id: string | null;
  @Expose() const_id: string;
  @Expose() is_incumbent: boolean;

  /** Populated from the Prisma `parties` relation. */
  @Expose({ name: 'parties' })
  @Type(() => PartyMiniDto)
  party?: PartyMiniDto;
}

/** One public candidate search hit (GET /search/candidates): the summary plus its election. */
export class CandidateSearchHitDto extends CandidateSummaryDto {
  @Expose() election_id: string;
}

/** Adds the affidavit for this run (assets and liabilities in rupees, BigInt columns sent as numbers). */
export class CandidateDetailDto extends CandidateSummaryDto {
  @Expose() election_id: string;
  @Expose() age: number | null;
  @Expose() @Transform(bigintTransform) assets: number | null;
  @Expose() @Transform(bigintTransform) liabilities: number | null;
  @Expose() criminal_cases: number | null;
}

/** Public person profile. */
export class PersonProfileDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() photo_url: string | null;
  @Expose() gender: string | null;
  @Expose() education: string | null;

  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  date_of_birth: Date | null;

  @Expose() bio: string | null;
  @Expose() wikipedia_url: string | null;
  /** Credit for photo_url when we host it (image_credits, migration 022). */
  @Expose() photo_credit: { source_url: string; author: string | null; licence: string } | null;
  @Expose() @Type(() => PlaceMiniDto) state: PlaceMiniDto | null;
  @Expose() @Type(() => PlaceMiniDto) district: PlaceMiniDto | null;
  // caste and religion are admin-only (AdminPersonDto): never exposed on the public profile.

  @Expose() candidates?: any[];
}
