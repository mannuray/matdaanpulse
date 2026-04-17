import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { PartiesService } from './parties.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { PartySummaryDto, PartyDetailDto } from './dto/party-response.dto';

@Controller('parties')
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Get()
  @UseInterceptors(new MapToDtoInterceptor(PartySummaryDto))
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('election_id') electionId?: string,
    @Query('state_id') stateId?: string,
  ) {
    if (page || limit || electionId || stateId) {
      const result = await this.partiesService.findPaginated(
        page ? +page : 1,
        limit ? +limit : 25,
        q,
        electionId,
        stateId ? +stateId : undefined,
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
