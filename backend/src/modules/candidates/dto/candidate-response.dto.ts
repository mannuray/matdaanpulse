import { Expose, Type, Transform } from 'class-transformer';

export class PartyMiniDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() color: string;
  @Expose() abbreviation: string | null;
}

export class CandidateSummaryDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() party_id: string | null;
  @Expose() const_id: string;
  @Expose() is_incumbent: boolean;

  @Expose()
  @Type(() => PartyMiniDto)
  party?: PartyMiniDto;
}

export class CandidateDetailDto extends CandidateSummaryDto {
  @Expose() metadata: any;
  @Expose() election_id: string;
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
  @Expose() metadata: any;
  
  @Expose() candidates?: any[];
}
