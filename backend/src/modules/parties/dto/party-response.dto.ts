import { Expose } from 'class-transformer';

export class PartySummaryDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() color: string;
  @Expose() abbreviation: string | null;
  @Expose() symbol_url: string | null;
  @Expose() eci_symbol_url: string | null;
  @Expose() eci_recognition: 'National' | 'State' | 'Unrecognised' | null;
  @Expose() candidate_count?: number;
}

export class PartyDetailDto extends PartySummaryDto {
  @Expose() leader_name: string | null;
  @Expose() founded_year: number | null;
  @Expose() headquarters: string | null;
  @Expose() website: string | null;
  @Expose() wikipedia_url: string | null;
  @Expose() description: string | null;
}
