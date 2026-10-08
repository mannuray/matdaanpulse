import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { SearchService } from './search.service';
import { ConstituencySearchQueryDto, SearchQueryDto } from '../../common/dto/query.dto';
import { CACHE_CONTROL, CacheControl } from '../../common/http/cache-control';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { CandidateSearchHitDto } from '../candidates/dto/candidate-response.dto';
import { ConstituencySearchHitDto } from '../constituencies/dto/constituency-response.dto';

@Controller('search')
@CacheControl(CACHE_CONTROL.PUBLIC)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /** Public seat summary + `district: { id, name }`; the raw row leaked internal columns and a Decimal-string turnout. */
  @Get('constituencies')
  @UseInterceptors(new MapToDtoInterceptor(ConstituencySearchHitDto))
  searchConstituencies(@Query() { q, election_id, district_id }: ConstituencySearchQueryDto) {
    return this.searchService.searchConstituencies(q, election_id, district_id);
  }

  /** Public shape only (no affidavit, so no BigInt): the raw row would 500 once a hit has assets. */
  @Get('candidates')
  @UseInterceptors(new MapToDtoInterceptor(CandidateSearchHitDto))
  searchCandidates(@Query() { q, election_id }: SearchQueryDto) {
    return this.searchService.searchCandidates(q, election_id);
  }
}
