import { Expose, Type, Transform } from 'class-transformer';
import { bigintTransform } from '../../../common/util/json-safe';

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

/** Adds the affidavit for this run (assets and liabilities in rupees, BigInt columns sent as numbers). */
export class CandidateDetailDto extends CandidateSummaryDto {
  @Expose() election_id: string;
  @Expose() age: number | null;
  @Expose() @Transform(bigintTransform) assets: number | null;
  @Expose() @Transform(bigintTransform) liabilities: number | null;
  @Expose() criminal_cases: number | null;
}

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
  @Expose() caste: string | null;
  @Expose() religion: string | null;

  @Expose() candidates?: any[];
}
