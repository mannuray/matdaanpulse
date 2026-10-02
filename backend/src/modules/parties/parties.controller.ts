import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { PartiesService } from './parties.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { PartySummaryDto, PartyDetailDto } from './dto/party-response.dto';
import { paginated } from '../../common/paginated';
import { PartiesQueryDto } from '../../common/dto/query.dto';
import { CACHE_CONTROL, CacheControl } from '../../common/http/cache-control';

@Controller('parties')
@CacheControl(CACHE_CONTROL.PUBLIC)
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Get()
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
    const allParties = await this.partiesService.findAll();
    return allParties || [];
  }

  @Get(':id')
  @UseInterceptors(new MapToDtoInterceptor(PartyDetailDto))
  findOne(@Param('id') id: string) {
    return this.partiesService.findOne(id);
  }
}
