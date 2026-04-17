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
  
  @Expose()
  @Type(() => StateSummaryDto)
  state?: StateSummaryDto;
}

export class ElectionDetailDto extends ElectionSummaryDto {
  @Expose() manifest_url: string | null;
  @Expose() manifest: any;
  @Expose() summary: any[];
}
