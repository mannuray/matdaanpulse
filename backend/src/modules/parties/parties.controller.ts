import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { PartiesService } from './parties.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { PartySummaryDto, PartyDetailDto, LineageEventDto, PartyRecordDto } from './dto/party-response.dto';
import { paginated } from '../../common/paginated';
import { PartiesQueryDto } from '../../common/dto/query.dto';
import { CACHE_CONTROL, CacheControl } from '../../common/http/cache-control';

@Controller('parties')
@CacheControl(CACHE_CONTROL.PUBLIC)
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  /**
   * Two response shapes, chosen by the query:
   * - any of page / limit / election_id / state_id / eci_recognition → the paged envelope `{ data, meta }`
   *   (admin Parties list), filtered by `q` too;
   * - otherwise → a bare array of every party (frontend party meta, admin party picker; CDN-cached with the
   *   long reference TTL), filtered by `q` when it is sent alone.
   */
  @Get()
  @CacheControl(CACHE_CONTROL.REFERENCE) // the admin's paged reads carry Authorization and stay no-store
  @UseInterceptors(new MapToDtoInterceptor(PartySummaryDto))
  async findAll(@Query() { page, limit, q, election_id, state_id, eci_recognition }: PartiesQueryDto) {
    if (page || limit || election_id || state_id || eci_recognition) {
      const result = await this.partiesService.findPaginated(
        page ?? 1,
        limit ?? 25,
        q,
        election_id,
        state_id,
        eci_recognition,
      );
      return paginated(
        result.data.map((p) => Object.assign(new PartySummaryDto(), p)),
        result.meta,
      );
    }
    const allParties = await this.partiesService.findAll(q);
    return allParties || [];
  }

  /** Party lineage events (renames, mergers, splits) for cross-election comparisons; small, CDN-cached. */
  @Get('lineage')
  @UseInterceptors(new MapToDtoInterceptor(LineageEventDto))
  findLineage() {
    return this.partiesService.findLineage();
  }

  /**
   * The party's record across Finalized VS elections; `?state=` adds that state's MLAs, seat flow and regions (party page).
   * Built only from Finalized elections, so it always gets the long finished-election TTL (a newly finalized election
   * shows within the hour; purge the CDN after editing a finished election).
   */
  @Get(':id/record')
  @CacheControl(CACHE_CONTROL.FINISHED)
  @UseInterceptors(new MapToDtoInterceptor(PartyRecordDto))
  record(@Param('id') id: string, @Query('state') state?: string) {
    return this.partiesService.record(id, state);
  }

  @Get(':id')
  @UseInterceptors(new MapToDtoInterceptor(PartyDetailDto))
  findOne(@Param('id') id: string) {
    return this.partiesService.findOne(id);
  }
}
