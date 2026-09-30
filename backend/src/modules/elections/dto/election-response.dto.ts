import { Expose, Type } from 'class-transformer';

export class StateSummaryDto {
  @Expose() id: number;
  @Expose() name: string;
  @Expose() code: string;
}

export class ElectionSummaryDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() type: string;
  @Expose() status: string;
  @Expose() year: number;
  @Expose() state_id: number | null;
  /** Date column; serialised as an ISO timestamp. The dashboard poller reads it (shouldPoll). */
  @Expose() tentative_next_date: Date | null;

  /** Populated from the Prisma `states` relation. */
  @Expose({ name: 'states' })
  @Type(() => StateSummaryDto)
  state?: StateSummaryDto;
}

export class ElectionDetailDto extends ElectionSummaryDto {
  @Expose() manifest_url: string | null;
  @Expose() manifest: any;
  @Expose() summary: any[];
}
