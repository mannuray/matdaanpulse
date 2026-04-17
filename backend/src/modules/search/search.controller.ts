import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('constituencies')
  searchConstituencies(
    @Query('q') q?: string,
    @Query('election_id') election_id?: string,
    @Query('district_id') district_id?: string,
  ) {
    return this.searchService.searchConstituencies(q, election_id, district_id ? parseInt(district_id) : undefined);
  }

  @Get('candidates')
  searchCandidates(
    @Query('q') q?: string,
    @Query('election_id') election_id?: string,
  ) {
    return this.searchService.searchCandidates(q, election_id);
  }
}
