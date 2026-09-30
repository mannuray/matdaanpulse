import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards, Sse, Logger, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { ConstituenciesService } from '../../constituencies/constituencies.service';
import { AiEnrichmentService } from '../../ai/ai-enrichment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RedisService } from '../../redis/redis.service';
import { Observable, map, finalize, filter } from 'rxjs';
import { sharedSseStream, withReconnectHint } from '../../../common/sse/shared-sse-stream';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminConstituencyDto, AdminAnalysisDto } from '../dto/admin-response.dto';
import {
  UpdateConstituencyDto, BulkTagDto, ComputeAnalysisDto, UpdateAnalysisDto,
  BulkAiStatusDto, EnrichConstituenciesDto,
} from '../dto/admin-input.dto';

@Controller('admin/constituencies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminConstituenciesController {
  private readonly logger = new Logger(AdminConstituenciesController.name);
  private readonly sharedStreams = new Map<string, Observable<MessageEvent>>();

  constructor(
    private readonly constituenciesService: ConstituenciesService,
    private readonly aiService: AiEnrichmentService,
    private readonly redis: RedisService,
  ) {}

  @Get('list/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  getConstituencies(
    @Param('electionId', ParseUUIDPipe) electionId: string,
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
  updateConstituency(@Param('id') id: string, @Body() body: UpdateConstituencyDto) {
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
  bulkTag(@Body() body: BulkTagDto) {
    return this.constituenciesService.bulkTag(body.ids, body.add_tags, body.remove_tags);
  }

  @Get('analysis/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  getAnalysis(@Param('electionId', ParseUUIDPipe) electionId: string) {
    return this.constituenciesService.getAnalysis(electionId);
  }

  @Post('analysis/compute/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  computeAnalysis(
    @Param('electionId', ParseUUIDPipe) electionId: string,
    @Body() body: ComputeAnalysisDto,
  ) {
    return this.constituenciesService.computeAnalysis(electionId, body.history_election_ids || [], body.manifest);
  }

  @Patch('analysis/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  updateAnalysis(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAnalysisDto) {
    return this.constituenciesService.updateAnalysis(id, body);
  }

  @Post('analysis/bulk-status')
  @Roles('SUPER_ADMIN', 'EDITOR')
  bulkUpdateAiStatus(@Body() body: BulkAiStatusDto) {
    return this.constituenciesService.bulkUpdateAiStatus(body.ids, body.status);
  }

  // AI Enrichment Endpoints
  @Post('enrich/:electionId')
  @Roles('SUPER_ADMIN')
  enrichConstituencies(
    @Param('electionId', ParseUUIDPipe) electionId: string,
    @Body() body?: EnrichConstituenciesDto,
  ) {
    return this.aiService.enrichConstituencies(electionId, body?.const_ids, body?.mode);
  }

  @Get('enrich/status/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  getEnrichmentStatus(@Param('electionId', ParseUUIDPipe) electionId: string) {
    return this.aiService.getProgress(electionId);
  }

  /**
   * Enrichment progress stream. Authenticated like every other route in this
   * controller (JwtAuthGuard + RolesGuard via `Authorization: Bearer`); the admin
   * client reads it with fetch() and parses text/event-stream itself.
   * Emits `event: enrichment-progress` (JSON EnrichmentProgress) and `event: ping`.
   */
  @Sse('enrich/stream/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  stream(@Param('electionId', ParseUUIDPipe) electionId: string): Observable<MessageEvent> {
    let stream$ = this.sharedStreams.get(electionId);
    if (!stream$) {
      const channel = `enrichment:${electionId}:events`;
      const events$ = this.redis.subscribe(channel).pipe(
        map((raw) => {
          try {
            const parsed = JSON.parse(raw);
            // Pre-stringified so SseStream writes it verbatim (same as LiveService).
            return { data: JSON.stringify(parsed.data), type: parsed.type } as MessageEvent;
          } catch {
            return null as unknown as MessageEvent;
          }
        }),
        filter((evt): evt is MessageEvent => evt !== null),
      );

      stream$ = sharedSseStream(events$, {
        shutdown$: this.redis.shutdown$,
        onError: (err) => this.logger.error(`Enrichment stream error for ${electionId}: ${err.message}`),
        // Runs when the last subscriber leaves (share resets), on error or on
        // shutdown, so the next client builds a fresh stream.
        onTeardown: () => this.sharedStreams.delete(electionId),
      });
      this.sharedStreams.set(electionId, stream$);
    }

    return withReconnectHint(stream$).pipe(
      finalize(() => {
        this.logger.log(`Enrichment SSE client disconnected from ${electionId}`);
      }),
    );
  }
}
