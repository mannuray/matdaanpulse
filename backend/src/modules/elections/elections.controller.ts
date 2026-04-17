import { Controller, Get, Param, Query, ParseIntPipe, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { ElectionsService } from './elections.service';
import { ResultsService } from '../results/results.service';
import { ConstituenciesService } from '../constituencies/constituencies.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { ElectionSummaryDto, ElectionDetailDto } from './dto/election-response.dto';

@Controller('elections')
export class ElectionsController {
  constructor(
    private readonly electionsService: ElectionsService,
    private readonly resultsService: ResultsService,
    private readonly constituenciesService: ConstituenciesService,
  ) {}

  @Get()
  @UseInterceptors(new MapToDtoInterceptor(ElectionSummaryDto))
  findAll(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('state_id') state_id?: string,
    @Query('year') year?: string,
  ) {
    return this.electionsService.findAll({
      type,
      status,
      state_id: state_id ? parseInt(state_id) : undefined,
      year: year ? parseInt(year) : undefined,
    });
  }

  @Get(':id')
  @UseInterceptors(new MapToDtoInterceptor(ElectionDetailDto))
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const election = await this.electionsService.findOne(id);
    const summary = await this.resultsService.getElectionSummary(id);
    
    let manifest = null;
    if (election.manifest_url) {
      try {
        manifest = typeof election.manifest_url === 'string' 
          ? JSON.parse(election.manifest_url) 
          : election.manifest_url;
      } catch {
        // Invalid manifest JSON — ignore, return null
      }
    }

    return { ...election, manifest, summary };
  }

  @Get(':id/manifest')
  getManifest(@Param('id') id: string) {
    return this.electionsService.getManifest(id);
  }

  @Get(':id/results')
  getResults(@Param('id') id: string) {
    return this.resultsService.getResults(id);
  }

  @Get(':id/alliances')
  getAlliances(@Param('id') id: string) {
    // Standardizing terminology: what was 'alliances' is a summary/tally of won/leading
    return this.resultsService.getElectionSummary(id);
  }

  @Get(':id/vote-share')
  getVoteShare(@Param('id') id: string) {
    return this.resultsService.getVoteShare(id);
  }

  @Get(':id/analysis')
  getAnalysis(@Param('id') id: string) {
    return this.constituenciesService.getPublicAnalysis(id);
  }

  @Get(':id/constituencies/:constId/analysis')
  getConstituencyAnalysisDetail(
    @Param('id') id: string,
    @Param('constId') constId: string,
  ) {
    return this.constituenciesService.getConstituencyAnalysisDetail(id, constId);
  }

  @Get(':id/districts/:districtId/results')
  getDistrictResults(
    @Param('id') id: string,
    @Param('districtId', ParseIntPipe) districtId: number,
  ) {
    return this.resultsService.getDistrictResults(id, districtId);
  }

  @Get(':id/constituencies/:constId')
  getConstituencyDetail(
    @Param('id') id: string,
    @Param('constId') constId: string,
  ) {
    return this.resultsService.getConstituencyDetail(id, constId);
  }

  @Get(':id/compare')
  compare(@Param('id') id: string, @Query('to') to: string) {
    return this.resultsService.compareConstituencies(id, to);
  }
}
