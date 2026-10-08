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
  /** Boundary set the seats belong to (e.g. "2008"); seat history compares only elections of the same one. */
  @Expose() delimitation: string | null;

  /** Populated from the Prisma `states` relation. */
  @Expose({ name: 'states' })
  @Type(() => StateSummaryDto)
  state?: StateSummaryDto;
}

/**
 * Public election detail: the summary fields only. The manifest (raw `manifest_url` or parsed) and the seat tally
 * are not sent here; they have their own routes (`:id/manifest`, `:id/alliances`) and no client read them from this one.
 */
export class ElectionDetailDto extends ElectionSummaryDto {}
