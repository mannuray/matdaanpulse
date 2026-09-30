import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { ConstituencySearchQueryDto, SearchQueryDto } from '../../common/dto/query.dto';
import { CACHE_CONTROL, CacheControl } from '../../common/http/cache-control';

@Controller('search')
@CacheControl(CACHE_CONTROL.PUBLIC)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('constituencies')
  searchConstituencies(@Query() { q, election_id, district_id }: ConstituencySearchQueryDto) {
    return this.searchService.searchConstituencies(q, election_id, district_id);
  }

  @Get('candidates')
  searchCandidates(@Query() { q, election_id }: SearchQueryDto) {
    return this.searchService.searchCandidates(q, election_id);
  }
}
