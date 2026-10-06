import { Expose, Type } from 'class-transformer';

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

/** A party lineage event (migration 023); dates as YYYY-MM-DD. */
export class LineageEventDto {
  @Expose() party_id: string;
  @Expose() predecessor_id: string;
  @Expose() kind: 'rename' | 'merger' | 'split' | 'breakaway';
  @Expose() effective_date: string;
  @Expose() state_id: number | null;
  @Expose() is_successor: boolean;
  @Expose() note: string | null;
}

export class PartyUnitRoleDto {
  @Expose() role: 'state_president' | 'legislature_leader';
  @Expose() person_id: string | null;
  @Expose() person_name: string;
  @Expose() from_date: string | null;
  @Expose() to_date: string | null;
}

/** A party's unit in one state: recognition there, office, leadership terms (current first). */
export class PartyUnitDto {
  @Expose() state_id: number;
  @Expose() state_name: string;
  @Expose() eci_recognition: 'National' | 'State' | 'Unrecognised' | null;
  @Expose() office: string | null;
  @Expose() website: string | null;
  @Expose() @Type(() => PartyUnitRoleDto) roles: PartyUnitRoleDto[];
}

export class PartyDetailDto extends PartySummaryDto {
  @Expose() @Type(() => PartyUnitDto) units: PartyUnitDto[];
  @Expose() @Type(() => LineageEventDto) lineage: LineageEventDto[];
  @Expose() leader_name: string | null;
  @Expose() founded_year: number | null;
  @Expose() headquarters: string | null;
  @Expose() website: string | null;
  @Expose() wikipedia_url: string | null;
  @Expose() description: string | null;
}
