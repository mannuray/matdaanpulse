import {
  BadRequestException, Body, CanActivate, Controller, ExecutionContext, HttpCode, Injectable, Logger, Post, Query, Req,
  ServiceUnavailableException, Sse, UseGuards,
} from '@nestjs/common';
import { Observable, finalize } from 'rxjs';
import { SkipThrottle } from '@nestjs/throttler';
import { IsUuidLike } from '../../common/validation/uuid-like';
import { LiveStream } from './live.service';
import { SKIP_ALL_THROTTLERS } from '../../common/throttle/throttle.config';
import { MetricsService } from '../metrics/metrics.service';
import { LiveSseTokenService } from './live-sse-token.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Per-process cap on open SSE connections (admin Live Console only; viewers poll). */
export function resolveSseMaxConnections(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.SSE_MAX_CONNECTIONS);
  return Number.isInteger(n) && n > 0 ? n : 200;
}

/** Open admin SSE connections in this process. */
@Injectable()
export class SseConnections {
  open = 0;
  readonly max = resolveSseMaxConnections();

  /** Check-and-increment in one synchronous step, so concurrent requests cannot overshoot the cap. */
  tryAcquire(): boolean {
    if (this.open >= this.max) return false;
    this.open++;
    return true;
  }

  release() {
    this.open = Math.max(0, this.open - 1);
  }
}

/**
 * Runs before the handler so failures are real HTTP statuses (an error thrown inside
 * an @Sse handler would become a 200 stream with an `error` event): 400 bad id,
 * 401 bad/expired/foreign token, 503 when the per-process cap is reached.
 */
@Injectable()
export class LiveSseAccessGuard implements CanActivate {
  constructor(
    private readonly tokens: LiveSseTokenService,
    private readonly connections: SseConnections,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const { query } = context.switchToHttp().getRequest<{ query: Record<string, unknown> }>();
    const electionId = typeof query.election_id === 'string' ? query.election_id : '';
    if (!UUID_RE.test(electionId)) throw new BadRequestException('Valid election_id query parameter is required');
    this.tokens.verify(typeof query.token === 'string' ? query.token : undefined, electionId);
    // Claims the slot here; the handler's stream releases it (finalize) when the client goes away.
    if (!this.connections.tryAcquire()) throw new ServiceUnavailableException('Too many live stream connections');
    return true;
  }
}

class SseTokenDto {
  @IsUuidLike()
  election_id!: string;
}

/**
 * Admin live stream (the Live Console). Under /admin so CORS keeps the exact-origin
 * allowlist; opening it needs a short-lived SSE token from POST /admin/live/sse-token.
 */
@Controller('admin/live')
export class LiveController {
  private readonly logger = new Logger(LiveController.name);

  constructor(
    private readonly live: LiveStream,
    private readonly metrics: MetricsService,
    private readonly tokens: LiveSseTokenService,
    private readonly connections: SseConnections,
  ) {}

  @Post('sse-token')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'EDITOR')
  sseToken(@Req() req: { user?: { id: string } }, @Body() body: SseTokenDto) {
    return this.tokens.issue(req.user!.id, body.election_id);
  }

  // EventSource does not reconnect after a 429, so the stream is never throttled (it is capped instead).
  @Sse('updates')
  @SkipThrottle(SKIP_ALL_THROTTLERS)
  @UseGuards(LiveSseAccessGuard)
  updates(
    @Query('election_id') electionId: string,
    @Req() req: { on?: (event: string, cb: () => void) => unknown },
  ): Observable<MessageEvent> {
    // The guard already claimed a slot. Release it exactly once, whichever comes first:
    // the stream ending, the client closing the request, or a failure below.
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.connections.release();
      this.logger.log(`SSE client disconnected from election ${electionId}`);
      try {
        this.metrics.sseConnections.add(-1, { election_id: electionId });
      } catch {
        /* metrics must never block the release */
      }
    };
    try {
      this.logger.log(`SSE client connected for election ${electionId} (${this.connections.open} open)`);
      this.metrics.sseConnections.add(1, { election_id: electionId });
      // Backstop for an abort between the guard and Nest attaching its own 'close' handler.
      req.on?.('close', release);
      return this.live.streamEvents(electionId).pipe(finalize(release));
    } catch (err) {
      release();
      throw err;
    }
  }
}
