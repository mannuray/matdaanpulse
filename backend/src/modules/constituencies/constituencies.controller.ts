import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ConstituenciesService } from './constituencies.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { ConstituencySummaryDto } from './dto/constituency-response.dto';
import { ElectionIdQueryDto } from '../../common/dto/query.dto';

@Controller('constituencies')
export class ConstituenciesController {
  constructor(private readonly service: ConstituenciesService) {}

  @Get()
  @UseInterceptors(new MapToDtoInterceptor(ConstituencySummaryDto))
  findAll(@Query() { election_id }: ElectionIdQueryDto) {
    if (!election_id) return [];
    return this.service.findByElection(election_id);
  }
}
