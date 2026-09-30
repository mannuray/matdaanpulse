import { Controller, Get, Param, Query, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { PersonsService } from './persons.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { CandidateSummaryDto, CandidateDetailDto, PersonProfileDto } from './dto/candidate-response.dto';
import { CandidatesQueryDto, SearchQueryDto } from '../../common/dto/query.dto';

@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly personsService: PersonsService,
  ) {}

  @Get()
  @UseInterceptors(new MapToDtoInterceptor(CandidateSummaryDto))
  findAll(@Query() { election_id, const_id }: CandidatesQueryDto) {
    return this.candidatesService.findAll({ election_id, const_id });
  }

  @Get('search')
  @UseInterceptors(new MapToDtoInterceptor(CandidateSummaryDto))
  search(@Query() { q, election_id }: SearchQueryDto) {
    if (!q || q.trim().length < 2) return [];
    return this.candidatesService.findByName(q.trim(), election_id);
  }

  @Get(':id')
  @UseInterceptors(new MapToDtoInterceptor(CandidateDetailDto))
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.findOne(id);
  }

  @Get('persons/:id')
  @UseInterceptors(new MapToDtoInterceptor(PersonProfileDto))
  findPerson(@Param('id', ParseUUIDPipe) id: string) {
    return this.personsService.findWithCandidates(id);
  }
}
