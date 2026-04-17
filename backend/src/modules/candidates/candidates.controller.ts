import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { PersonsService } from './persons.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { CandidateSummaryDto, CandidateDetailDto, PersonProfileDto } from './dto/candidate-response.dto';

@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly personsService: PersonsService,
  ) {}

  @Get()
  @UseInterceptors(new MapToDtoInterceptor(CandidateSummaryDto))
  findAll(
    @Query('election_id') election_id?: string,
    @Query('const_id') const_id?: string,
  ) {
    return this.candidatesService.findAll({ election_id, const_id });
  }

  @Get('search')
  @UseInterceptors(new MapToDtoInterceptor(CandidateSummaryDto))
  search(@Query('q') q?: string, @Query('election_id') election_id?: string) {
    if (!q || q.trim().length < 2) return [];
    return this.candidatesService.findByName(q.trim(), election_id);
  }

  @Get(':id')
  @UseInterceptors(new MapToDtoInterceptor(CandidateDetailDto))
  findOne(@Param('id') id: string) {
    return this.candidatesService.findOne(id);
  }

  @Get('persons/:id')
  @UseInterceptors(new MapToDtoInterceptor(PersonProfileDto))
  findPerson(@Param('id') id: string) {
    return this.personsService.findWithCandidates(id);
  }
}
