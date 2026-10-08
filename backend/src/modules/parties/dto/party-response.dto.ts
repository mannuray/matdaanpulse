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
  @Expose() source_url: string | null;
}

export class PartyUnitRoleDto {
  @Expose() role: 'state_president' | 'legislature_leader';
  @Expose() person_id: string | null;
  @Expose() person_name: string;
  @Expose() from_date: string | null;
  @Expose() to_date: string | null;
  @Expose() photo_url: string | null;
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

/** GET /parties/:id/record (party page spec §2). */
export class PartyRecordFamilyDto {
  @Expose() party_id: string;
  @Expose() won: number;
  @Expose() share: number;
}

export class PartyRecordElectionDto {
  @Expose() election_id: string;
  @Expose() state_id: number;
  @Expose() state_code: string;
  @Expose() state_name: string;
  @Expose() year: number;
  @Expose() date: string;
  @Expose() delimitation: string | null;
  @Expose() contested: number;
  @Expose() won: number;
  @Expose() votes: number;
  @Expose() share: number;
  @Expose() held: number;
  @Expose() gained: number;
  @Expose() lost: number;
  @Expose() split_gained: number;
  @Expose() split_lost: number;
  @Expose() seats_total: number;
  @Expose() largest: boolean;
  @Expose() formed_government: boolean | null;
  @Expose() @Type(() => PartyRecordFamilyDto) family: PartyRecordFamilyDto[];
}

export class PartyRecordMlaDto {
  @Expose() person_id: string | null;
  @Expose() name: string;
  @Expose() photo_url: string | null;
  @Expose() const_id: string;
  @Expose() const_name: string;
  @Expose() margin: number | null;
}

export class PartyRecordFlowDto {
  @Expose() from: string;
  @Expose() to: string;
  @Expose() seats: number;
  @Expose() split: boolean;
}

export class PartyRecordRegionDto {
  @Expose() region: string;
  @Expose() seats: number;
  @Expose() won: number;
}

export class PartyRecordStateDto {
  @Expose() code: string;
  @Expose() election_id: string;
  @Expose() @Type(() => PartyRecordMlaDto) mlas: PartyRecordMlaDto[];
  @Expose() @Type(() => PartyRecordFlowDto) flow: PartyRecordFlowDto[];
  @Expose() @Type(() => PartyRecordRegionDto) regions: PartyRecordRegionDto[] | null;
}

export class PartyRecordDto {
  @Expose() party_id: string;
  @Expose() @Type(() => PartyRecordElectionDto) elections: PartyRecordElectionDto[];
  @Expose() @Type(() => LineageEventDto) lineage: LineageEventDto[];
  @Expose() @Type(() => PartyRecordStateDto) state?: PartyRecordStateDto;
}
