import { Controller, Get, HttpStatus, Inject, Logger, Optional, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { RedisHealth } from '../redis/redis.ports';
import { SKIP_ALL_THROTTLERS } from '../../common/throttle/throttle.config';
import { withTimeout } from '../../common/util/with-timeout';

export const HEALTH_CHECK_TIMEOUT_MS = 2000;
/** One readiness answer is shared for this long (DI token; tests set 0): a looping caller costs one DB query per window. */
export const HEALTH_MEMO_MS = 'HEALTH_MEMO_MS';
const DEFAULT_HEALTH_MEMO_MS = 2000;

type Check = { status: 'healthy' | 'unhealthy'; latencyMs: number };
type Readiness = { status: 'healthy' | 'degraded' | 'unhealthy'; checks: { database: Check; redis: Check } };

/**
 * - GET /health/live  — liveness for the platform health check (Render): no I/O, always 200.
 * - GET /health/ready — readiness: DB `SELECT 1` + Redis PING (2 s timeouts) + subscriber connection ready.
 *   503 "unhealthy" only when the DB fails; Redis down is 200 "degraded" (Redis is optional: the cache falls back to
 *   the DB, only the admin live console loses events). One answer is shared for HEALTH_MEMO_MS.
 * - GET /health       — alias of /health/ready (backward compatible).
 * Error details go to the logs only. Never throttled.
 */
@Controller('health')
@SkipThrottle(SKIP_ALL_THROTTLERS)
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime = Date.now();
  private memo: { at: number; result: Promise<Readiness> } | null = null;
  private readonly memoMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisHealth,
    @Optional() @Inject(HEALTH_MEMO_MS) memoMs?: number,
  ) {
    this.memoMs = memoMs ?? DEFAULT_HEALTH_MEMO_MS;
  }

  @Get('live')
  live() {
    return { status: 'ok', uptimeSeconds: this.uptime() };
  }

  @Get('ready')
  ready(@Res({ passthrough: true }) res: Response) {
    return this.readiness(res);
  }

  @Get()
  check(@Res({ passthrough: true }) res: Response) {
    return this.readiness(res);
  }

  private async readiness(res: Response) {
    const { status, checks } = await this.shared();
    res.status(status === 'unhealthy' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK);
    return { status, checks, uptimeSeconds: this.uptime(), timestamp: new Date().toISOString() };
  }

  /** The in-flight or recent readiness check, so concurrent and repeated calls share one DB query. */
  private shared(): Promise<Readiness> {
    const now = Date.now();
    if (this.memo && now - this.memo.at < this.memoMs) return this.memo.result;
    const result = this.runChecks();
    this.memo = { at: now, result };
    return result;
  }

  private async runChecks(): Promise<Readiness> {
    const [database, redis] = await Promise.all([
      this.probe('database', () => this.prisma.$queryRaw`SELECT 1`),
      this.probe('redis', async () => {
        await this.redis.ping(HEALTH_CHECK_TIMEOUT_MS);
        // Live SSE events need the subscriber connection too, not just PING on pub.
        if (!this.redis.isSubscriberReady()) throw new Error('Redis subscriber connection is not ready');
      }),
    ]);
    const status = database.status !== 'healthy' ? 'unhealthy' : redis.status !== 'healthy' ? 'degraded' : 'healthy';
    return { status, checks: { database, redis } };
  }

  private async probe(name: string, fn: () => Promise<unknown>): Promise<Check> {
    const start = Date.now();
    try {
      await withTimeout(fn(), HEALTH_CHECK_TIMEOUT_MS, `${name} check`);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (e) {
      this.logger.warn(`Readiness: ${name} unhealthy: ${(e as Error).message}`);
      return { status: 'unhealthy', latencyMs: Date.now() - start };
    }
  }

  private uptime() {
    return Math.round((Date.now() - this.startTime) / 1000);
  }
}
