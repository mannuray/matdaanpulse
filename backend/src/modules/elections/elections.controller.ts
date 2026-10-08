import { Controller, Get, Param, Query, UseInterceptors, ParseUUIDPipe, Req, Res } from '@nestjs/common';
import { VersionNotReadyException } from '../../common/exceptions/base.exception';
import type { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
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
import { LiveStateService, type LiveElectionStatus } from '../results/live-state.service';
import { SkipThrottle } from '@nestjs/throttler';
import { SKIP_ALL_THROTTLERS } from '../../common/throttle/throttle.config';
import { SnapshotBodyCache, sendSnapshotBody } from '../results/snapshot-body-cache';

type Policy = (typeof CACHE_CONTROL)[keyof typeof CACHE_CONTROL];

/** Same path the request came in on (whatever prefix it is mounted under), with `?v=<version>`. */
function versionUrl(req: Request, version: number): string {
  return `${(req.originalUrl ?? req.url).split('?')[0]}?v=${version}`;
}

/**
 * Every election-scoped read sets its CDN policy from the election status (docs/DEPLOYMENT.md §2.2):
 * Finalized → FINISHED (long TTL); Live → the route's counting policy; otherwise the default PUBLIC.
 * The status comes from LiveStateService's memo (single-flight, 1 s), so it costs no query per request.
 */
@Controller('elections')
@CacheControl(CACHE_CONTROL.PUBLIC)
export class ElectionsController {
  constructor(
    private readonly electionsService: ElectionsService,
    private readonly resultsService: ResultsService,
    private readonly constituenciesService: ConstituenciesService,
    private readonly liveState: LiveStateService,
    private readonly seatAnalysis: SeatAnalysisService,
    private readonly snapshotBodies: SnapshotBodyCache,
  ) {}

  /** The election's status, or null when it cannot be read (the data load reports a missing election itself). */
  private status(id: string): Promise<LiveElectionStatus | null> {
    return this.liveState.get(id).then((s) => s.status, () => null);
  }

  private policyFor(status: LiveElectionStatus | null, live: Policy = CACHE_CONTROL.PUBLIC, other: Policy = CACHE_CONTROL.PUBLIC): Policy {
    return status === 'Finalized' ? CACHE_CONTROL.FINISHED : status === 'Live' ? live : other;
  }

  /** Load the data and the status together; set the status policy (an error replaces it with no-store). */
  private async withPolicy<T>(id: string, req: Request, res: Response, load: () => Promise<T>, live?: Policy, other?: Policy): Promise<T> {
    const [data, status] = await Promise.all([load(), this.status(id)]);
    applyCacheControl(req, res, this.policyFor(status, live, other));
    return data;
  }

  /**
   * Polled by viewers (via the CDN): `{ version, status, updatedAt, declared, total }`.
   * CDN-cached 5 s while counting (Live), 30 s otherwise. Not throttled per IP: every viewer behind one carrier
   * NAT polls it, and the CDN answers almost all of them (its rate-limit rule bounds cache-busting misses).
   */
  @Get(':id/live')
  @SkipThrottle(SKIP_ALL_THROTTLERS)
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
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // The election row only: the manifest is GET :id/manifest and the tally GET :id/alliances (no client read them here).
    return this.withPolicy(id, req, res, () => this.electionsService.findOne(id));
  }

  @Get(':id/manifest')
  getManifest(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withPolicy(id, req, res, () => this.electionsService.getManifest(id));
  }

  /**
   * Without ?v: the latest results rows (short CDN cache while counting, long once Finalized).
   * With ?v=<version> (from /live): a snapshot `{ version, results, summary, voteShare }`.
   * - v = current: immutable (a version never changes).
   * - v < current: short-cached redirect to the current version's URL; old data is
   *   never served under a URL that claims to be a version.
   * - v > current (a poll raced ahead of this instance's 1 s memo, or a made-up v): 404 no-store, answered from the
   *   memo without loading anything (these routes are not throttled); the client retries on its next poll.
   */
  @Get(':id/results')
  @SkipThrottle(SKIP_ALL_THROTTLERS) // versioned snapshots are fetched by every viewer on each version change (see getLive)
  async getResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ResultsQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (query.v === undefined) {
      const rows = await this.withPolicy(id, req, res, () => this.resultsService.getResults(id), CACHE_CONTROL.RESULTS_LATEST);
      res.json(successEnvelope(rows));
      return;
    }
    const { version } = await this.liveState.get(id);
    if (query.v > version) throw new VersionNotReadyException();
    if (query.v < version) {
      applyCacheControl(req, res, CACHE_CONTROL.REDIRECT);
      res.redirect(302, versionUrl(req, version));
      return;
    }
    // v = current. A version's body never changes: replay the serialized + gzipped one when this process has it.
    const key = `${id}:${query.v}`;
    const cached = this.snapshotBodies.get(key);
    if (cached) {
      applyCacheControl(req, res, CACHE_CONTROL.IMMUTABLE);
      await sendSnapshotBody(req, res, cached);
      return;
    }
    // Read consistently (version + rows in one transaction). Immutable (and kept) only when the
    // snapshot really is version v; otherwise (the data moved on since the memo) no-store.
    const snapshot = await this.resultsService.getSnapshot(id, version);
    if (snapshot.version !== query.v) {
      applyCacheControl(req, res, CACHE_CONTROL.NO_STORE);
      res.json(successEnvelope(snapshot));
      return;
    }
    applyCacheControl(req, res, CACHE_CONTROL.IMMUTABLE);
    await sendSnapshotBody(req, res, await this.snapshotBodies.put(key, successEnvelope(snapshot)));
  }

  @Get(':id/alliances')
  getAlliances(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Standardizing terminology: what was 'alliances' is a summary/tally of won/leading
    return this.withPolicy(id, req, res, () => this.resultsService.getElectionSummary(id));
  }

  @Get(':id/vote-share')
  getVoteShare(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withPolicy(id, req, res, () => this.resultsService.getVoteShare(id));
  }

  /** Per-region party votes and seats (the region comparison shown after a redraw). */
  @Get(':id/region-shares')
  getRegionShares(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withPolicy(id, req, res, () => this.resultsService.getRegionShares(id));
  }

  /** Pre-counting facts per seat (spec §5.1); the browser runs the live analysis on it. Null until computed. */
  @Get(':id/baseline')
  getBaseline(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withPolicy(id, req, res, () => this.seatAnalysis.baseline(id));
  }

  /** Per-election seat analysis (party rows, seat flow, alliance change, close seats, bellwethers, breakdowns). */
  @Get(':id/analysis/summary')
  getAnalysisSummary(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withPolicy(id, req, res, () => this.seatAnalysis.summary(id));
  }

  @Get(':id/analysis')
  getAnalysis(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withPolicy(id, req, res, () => this.constituenciesService.getPublicAnalysis(id));
  }

  @Get(':id/constituencies/:constId/analysis')
  getConstituencyAnalysisDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('constId') constId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withPolicy(id, req, res, () => this.constituenciesService.getConstituencyAnalysisDetail(id, constId));
  }

  /** A seat's counting timeline (seat dialog sparkline); short CDN cache until the election is Finalized. */
  @Get(':id/constituencies/:constId/rounds')
  getSeatRounds(@Param('id', ParseUUIDPipe) id: string, @Param('constId') constId: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withPolicy(id, req, res, () => this.resultsService.getSeatRounds(id, constId), CACHE_CONTROL.RESULTS_LATEST, CACHE_CONTROL.RESULTS_LATEST);
  }

  /**
   * Seat detail. Without ?v: short CDN cache while Live (RESULTS_LATEST), long once Finalized, default otherwise.
   * With ?v=<version> (from /live), like results?v=:
   * - v > current: 404 no-store, nothing loaded; v < current: short-cached 302 to `?v=<current>`, nothing loaded;
   * - v = current while Live: immutable, but only if the version read from the DB after loading is still v (the detail
   *   is several queries, not one snapshot transaction; a write in between → no-store);
   * - v = current while not counting: the status policy, never immutable (photos, affidavits and other non-result
   *   fields change without a version bump, and a finished election's version no longer moves).
   */
  @Get(':id/constituencies/:constId')
  async getConstituencyDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('constId') constId: string,
    @Query() query: ResultsQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const send = (data: unknown, policy: Policy) => {
      applyCacheControl(req, res, policy);
      res.json(successEnvelope(plainToInstance(ConstituencyDetailDto, data, { excludeExtraneousValues: true })));
    };
    if (query.v === undefined) {
      const [data, status] = await Promise.all([this.resultsService.getConstituencyDetail(id, constId), this.status(id)]);
      send(data, this.policyFor(status, CACHE_CONTROL.RESULTS_LATEST));
      return;
    }
    const { version, status } = await this.liveState.get(id);
    if (query.v > version) throw new VersionNotReadyException();
    if (query.v < version) {
      applyCacheControl(req, res, CACHE_CONTROL.REDIRECT);
      res.redirect(302, versionUrl(req, version));
      return;
    }
    const data = await this.resultsService.getConstituencyDetail(id, constId);
    if (status !== 'Live') {
      send(data, this.policyFor(status));
      return;
    }
    // Versions only grow and every result write bumps one: data read after seeing v, with v still current
    // afterwards, is exactly version v.
    const after = await this.liveState.currentVersion(id);
    send(data, after === query.v ? CACHE_CONTROL.IMMUTABLE : CACHE_CONTROL.NO_STORE);
  }
}
