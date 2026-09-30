import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { PartiesService } from './parties.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { PartySummaryDto, PartyDetailDto } from './dto/party-response.dto';
import { PartiesQueryDto } from '../../common/dto/query.dto';

@Controller('parties')
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Get()
  @UseInterceptors(new MapToDtoInterceptor(PartySummaryDto))
  async findAll(@Query() { page, limit, q, election_id, state_id }: PartiesQueryDto) {
    if (page || limit || election_id || state_id) {
      const result = await this.partiesService.findPaginated(
        page ?? 1,
        limit ?? 25,
        q,
        election_id,
        state_id,
      );
      // For paginated results, the interceptor needs to handle the nested 'data' array
      // or we map it manually here. Let's map manually for paginated to be safe.
      return {
        ...result,
        data: result.data.map(p => Object.assign(new PartySummaryDto(), p))
      };
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
