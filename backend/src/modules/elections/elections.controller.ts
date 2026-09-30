import { Controller, Get, Param, Query, ParseIntPipe, UseInterceptors, ParseUUIDPipe, BadRequestException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ElectionsService } from './elections.service';
import { ResultsService } from '../results/results.service';
import { ConstituenciesService } from '../constituencies/constituencies.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { ElectionSummaryDto, ElectionDetailDto } from './dto/election-response.dto';
import { ElectionsQueryDto, ResultsQueryDto } from '../../common/dto/query.dto';
import { CACHE_CONTROL, CacheControl } from '../../common/http/cache-control';
import { successEnvelope } from '../../common/interceptors/transform.interceptor';
import { LiveStateService } from '../results/live-state.service';
import { API_PREFIX } from '../../app.setup';

@Controller('elections')
@CacheControl(CACHE_CONTROL.PUBLIC)
export class ElectionsController {
  constructor(
    private readonly electionsService: ElectionsService,
    private readonly resultsService: ResultsService,
    private readonly constituenciesService: ConstituenciesService,
    private readonly liveState: LiveStateService,
  ) {}

  /** Polled by viewers (via the CDN): `{ version, updatedAt, declared, total }`. */
  @Get(':id/live')
  @CacheControl(CACHE_CONTROL.LIVE)
  getLive(@Param('id', ParseUUIDPipe) id: string) {
    return this.liveState.get(id);
  }

  @Get()
  @UseInterceptors(new MapToDtoInterceptor(ElectionSummaryDto))
  findAll(@Query() query: ElectionsQueryDto) {
    return this.electionsService.findAll({
      type: query.type,
      status: query.status,
      state_id: query.state_id,
      year: query.year,
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
  getManifest(@Param('id', ParseUUIDPipe) id: string) {
    return this.electionsService.getManifest(id);
  }

  /**
   * Without ?v: the latest results rows (short CDN cache).
   * With ?v=<version> (from /live): a snapshot `{ version, results, summary, voteShare }`.
   * - v = current: immutable (a version never changes).
   * - v < current: short-cached redirect to the current version's URL; old data is
   *   never served under a URL that claims to be a version.
   * - v > current (poll raced ahead of this instance): current data, not stored.
   */
  @Get(':id/results')
  async getResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ResultsQueryDto,
    @Res() res: Response,
  ) {
    if (query.v === undefined) {
      const rows = await this.resultsService.getResults(id);
      res.setHeader('Cache-Control', CACHE_CONTROL.RESULTS_LATEST);
      res.json(successEnvelope(rows));
      return;
    }
    const { version } = await this.liveState.get(id);
    if (query.v < version) {
      res.setHeader('Cache-Control', CACHE_CONTROL.REDIRECT);
      res.redirect(302, `/${API_PREFIX}/elections/${id}/results?v=${version}`);
      return;
    }
    const snapshot = await this.resultsService.getSnapshot(id, version);
    res.setHeader('Cache-Control', query.v === version ? CACHE_CONTROL.IMMUTABLE : CACHE_CONTROL.NO_STORE);
    res.json(successEnvelope(snapshot));
  }

  @Get(':id/alliances')
  getAlliances(@Param('id', ParseUUIDPipe) id: string) {
    // Standardizing terminology: what was 'alliances' is a summary/tally of won/leading
    return this.resultsService.getElectionSummary(id);
  }

  @Get(':id/vote-share')
  getVoteShare(@Param('id', ParseUUIDPipe) id: string) {
    return this.resultsService.getVoteShare(id);
  }

  @Get(':id/analysis')
  getAnalysis(@Param('id', ParseUUIDPipe) id: string) {
    return this.constituenciesService.getPublicAnalysis(id);
  }

  @Get(':id/constituencies/:constId/analysis')
  getConstituencyAnalysisDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('constId') constId: string,
  ) {
    return this.constituenciesService.getConstituencyAnalysisDetail(id, constId);
  }

  @Get(':id/districts/:districtId/results')
  getDistrictResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('districtId', ParseIntPipe) districtId: number,
  ) {
    return this.resultsService.getDistrictResults(id, districtId);
  }

  @Get(':id/constituencies/:constId')
  getConstituencyDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('constId') constId: string,
  ) {
    return this.resultsService.getConstituencyDetail(id, constId);
  }

  /** Compare two constituencies of this election: /elections/:id/compare?from=<constId>&to=<constId> */
  @Get(':id/compare')
  compare(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) throw new BadRequestException('Both "from" and "to" constituency ids are required');
    return this.resultsService.compareConstituencies(id, from, to);
  }
}
