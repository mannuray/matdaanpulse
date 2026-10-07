import { Controller, Get, Param, Query, ParseIntPipe, UseInterceptors, ParseUUIDPipe, BadRequestException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ElectionsService } from './elections.service';
import { ResultsService } from '../results/results.service';
import { ConstituenciesService } from '../constituencies/constituencies.service';
import { MapToDtoInterceptor } from '../common/interceptors/map-to-dto.interceptor';
import { ElectionSummaryDto, ElectionDetailDto } from './dto/election-response.dto';
import { ConstituencyDetailDto } from '../results/dto/constituency-detail.dto';
import { ElectionsQueryDto, ResultsQueryDto } from '../../common/dto/query.dto';
import { CACHE_CONTROL, CacheControl, applyCacheControl } from '../../common/http/cache-control';
import { successEnvelope } from '../../common/interceptors/transform.interceptor';
import { SeatAnalysisService } from '../constituencies/seat-analysis.service';
import { LiveStateService } from '../results/live-state.service';

@Controller('elections')
@CacheControl(CACHE_CONTROL.PUBLIC)
export class ElectionsController {
  constructor(
    private readonly electionsService: ElectionsService,
    private readonly resultsService: ResultsService,
    private readonly constituenciesService: ConstituenciesService,
    private readonly liveState: LiveStateService,
    private readonly seatAnalysis: SeatAnalysisService,
  ) {}

  /**
   * Polled by viewers (via the CDN): `{ version, status, updatedAt, declared, total }`.
   * CDN-cached 5 s while counting (Live), 30 s otherwise.
   */
  @Get(':id/live')
  async getLive(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const state = await this.liveState.get(id);
    applyCacheControl(req, res, state.status === 'Live' ? CACHE_CONTROL.LIVE : CACHE_CONTROL.LIVE_IDLE);
    return state;
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
    const manifest = await this.electionsService.comparableManifest(election, this.electionsService.parseManifest(election.manifest_url));

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
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (query.v === undefined) {
      const rows = await this.resultsService.getResults(id);
      applyCacheControl(req, res, CACHE_CONTROL.RESULTS_LATEST);
      res.json(successEnvelope(rows));
      return;
    }
    const { version } = await this.liveState.get(id);
    if (query.v < version) {
      applyCacheControl(req, res, CACHE_CONTROL.REDIRECT);
      // Same path the request came in on (whatever prefix it is mounted under), current version.
      const path = (req.originalUrl ?? req.url).split('?')[0];
      res.redirect(302, `${path}?v=${version}`);
      return;
    }
    // Read consistently (version + rows in one transaction). Immutable only when the
    // snapshot really is version v; otherwise (v ahead of us, or the data moved on) no-store.
    const snapshot = await this.resultsService.getSnapshot(id, version);
    applyCacheControl(req, res, snapshot.version === query.v ? CACHE_CONTROL.IMMUTABLE : CACHE_CONTROL.NO_STORE);
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

  /** Per-region party votes and seats (the region comparison shown after a redraw). */
  @Get(':id/region-shares')
  getRegionShares(@Param('id', ParseUUIDPipe) id: string) {
    return this.resultsService.getRegionShares(id);
  }

  /** Pre-counting facts per seat (spec §5.1); the browser runs the live analysis on it. Null until computed. */
  @Get(':id/baseline')
  getBaseline(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    applyCacheControl(req, res, CACHE_CONTROL.PUBLIC);
    return this.seatAnalysis.baseline(id);
  }

  /** Per-election seat analysis (party rows, seat flow, alliance change, close seats, bellwethers, breakdowns). */
  @Get(':id/analysis/summary')
  getAnalysisSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.seatAnalysis.summary(id);
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

  /** A seat's counting timeline (seat dialog sparkline); short CDN cache while counting. */
  @Get(':id/constituencies/:constId/rounds')
  getSeatRounds(@Param('id', ParseUUIDPipe) id: string, @Param('constId') constId: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    applyCacheControl(req, res, CACHE_CONTROL.RESULTS_LATEST);
    return this.resultsService.getSeatRounds(id, constId);
  }

  @Get(':id/constituencies/:constId')
  @UseInterceptors(new MapToDtoInterceptor(ConstituencyDetailDto))
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
