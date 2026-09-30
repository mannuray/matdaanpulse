import { Controller, Get, HttpStatus, Logger, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SKIP_ALL_THROTTLERS } from '../../common/throttle/throttle.config';
import { withTimeout } from '../../common/util/with-timeout';

export const HEALTH_CHECK_TIMEOUT_MS = 2000;

type Check = { status: 'healthy' | 'unhealthy'; latencyMs: number };

/**
 * - GET /health/live  — liveness for the platform health check (Render): no I/O, always 200.
 * - GET /health/ready — readiness: DB `SELECT 1` + Redis PING (2 s timeouts) + subscriber
 *   connection ready; 503 if any fails.
 * - GET /health       — alias of /health/ready (backward compatible).
 * Error details go to the logs only. Never throttled.
 */
@Controller('health')
@SkipThrottle(SKIP_ALL_THROTTLERS)
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

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
    const [database, redis] = await Promise.all([
      this.probe('database', () => this.prisma.$queryRaw`SELECT 1`),
      this.probe('redis', async () => {
        await this.redis.ping(HEALTH_CHECK_TIMEOUT_MS);
        // Live SSE events need the subscriber connection too, not just PING on pub.
        if (!this.redis.isSubscriberReady()) throw new Error('Redis subscriber connection is not ready');
      }),
    ]);
    const healthy = database.status === 'healthy' && redis.status === 'healthy';
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: healthy ? 'healthy' : 'degraded',
      checks: { database, redis },
      uptimeSeconds: this.uptime(),
      timestamp: new Date().toISOString(),
    };
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
