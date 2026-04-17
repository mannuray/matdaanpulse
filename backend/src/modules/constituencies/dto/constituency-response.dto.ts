import { Expose } from 'class-transformer';

export class ConstituencySummaryDto {
  @Expose() id: string;
  @Expose() election_id: string;
  @Expose() name: string;
  @Expose() const_no: number;
  @Expose() type: string;
  @Expose() voter_turnout: number | null;
  @Expose() phase: number | null;
  @Expose() current_round: number | null;
  @Expose() total_rounds: number | null;
}
