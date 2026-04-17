import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards, Sse, Logger, UnauthorizedException, UseInterceptors } from '@nestjs/common';
import { ConstituenciesService } from '../../constituencies/constituencies.service';
import { AiEnrichmentService, EnrichmentMode } from '../../ai/ai-enrichment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import { Observable, merge, interval, map, share, finalize, filter, EMPTY, catchError } from 'rxjs';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminConstituencyDto, AdminAnalysisDto } from '../dto/admin-response.dto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEARTBEAT_MS = 30_000;

@Controller('admin/constituencies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminConstituenciesController {
  private readonly logger = new Logger(AdminConstituenciesController.name);
  private readonly sharedStreams = new Map<string, Observable<MessageEvent>>();
  private readonly heartbeat$ = interval(HEARTBEAT_MS).pipe(
    map(() => ({ data: '', type: 'ping' } as MessageEvent)),
    share(),
  );

  constructor(
    private readonly constituenciesService: ConstituenciesService,
    private readonly aiService: AiEnrichmentService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  @Get('list/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  getConstituencies(
    @Param('electionId') electionId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.constituenciesService.findByElectionWithAnalysis(
      electionId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 100,
      q
    );
  }

  @Get('detail/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  getConstituencyDetail(@Param('id') id: string) {
    return this.constituenciesService.findOneWithAnalysis(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  updateConstituency(@Param('id') id: string, @Body() body: { district_id?: number | null; region_id?: number | null; const_no?: number; metadata?: Record<string, any> }) {
    return this.constituenciesService.updateConstituency(id, body);
  }

  @Patch(':id/metadata')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  updateMetadata(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.constituenciesService.updateMetadata(id, body);
  }

  @Post('bulk-tag')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  bulkTag(@Body() body: { ids: string[]; add_tags?: string[]; remove_tags?: string[] }) {
    return this.constituenciesService.bulkTag(body.ids, body.add_tags, body.remove_tags);
  }

  @Get('analysis/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  getAnalysis(@Param('electionId') electionId: string) {
    return this.constituenciesService.getAnalysis(electionId);
  }

  @Post('analysis/compute/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  computeAnalysis(
    @Param('electionId') electionId: string,
    @Body() body: { history_election_ids?: string[]; manifest?: Record<string, unknown> },
  ) {
    return this.constituenciesService.computeAnalysis(electionId, body.history_election_ids || [], body.manifest);
  }

  @Patch('analysis/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  updateAnalysis(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.constituenciesService.updateAnalysis(id, body);
  }

  @Post('analysis/bulk-status')
  @Roles('SUPER_ADMIN', 'EDITOR')
  bulkUpdateAiStatus(@Body() body: { ids: string[]; status: string }) {
    return this.constituenciesService.bulkUpdateAiStatus(body.ids, body.status);
  }

  // AI Enrichment Endpoints
  @Post('enrich/:electionId')
  @Roles('SUPER_ADMIN')
  enrichConstituencies(
    @Param('electionId') electionId: string,
    @Body() body?: { const_ids?: string[]; mode?: EnrichmentMode },
  ) {
    return this.aiService.enrichConstituencies(electionId, body?.const_ids, body?.mode);
  }

  @Get('enrich/status/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  getEnrichmentStatus(@Param('electionId') electionId: string) {
    return this.aiService.getProgress(electionId);
  }

  @Sse('enrich/stream/:electionId')
  stream(
    @Param('electionId') electionId: string,
    @Query('token') token: string,
  ): Observable<MessageEvent> {
    if (!token) throw new UnauthorizedException('Token required');
    try {
      const payload = this.jwt.verify(token);
      if (!payload?.role || !['SUPER_ADMIN', 'EDITOR'].includes(payload.role)) {
        throw new UnauthorizedException('Insufficient role');
      }
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!electionId || !UUID_RE.test(electionId)) {
      throw new UnauthorizedException('Valid electionId required');
    }

    let stream$ = this.sharedStreams.get(electionId);
    if (!stream$) {
      const channel = `enrichment:${electionId}:events`;
      const events$ = this.redis.subscribe(channel).pipe(
        map((raw) => {
          try {
            const parsed = JSON.parse(raw);
            return { data: JSON.stringify(parsed.data), type: parsed.type } as MessageEvent;
          } catch {
            return null as unknown as MessageEvent;
          }
        }),
        filter((evt): evt is MessageEvent => evt !== null),
        catchError((err) => {
          this.logger.error(`Enrichment stream error for ${electionId}: ${err.message}`);
          this.sharedStreams.delete(electionId);
          return EMPTY;
        }),
      );

      stream$ = merge(events$, this.heartbeat$).pipe(
        share({ resetOnRefCountZero: true }),
      );
      this.sharedStreams.set(electionId, stream$);
    }

    return stream$.pipe(
      finalize(() => {
        this.logger.log(`Enrichment SSE client disconnected from ${electionId}`);
      }),
    );
  }
}
