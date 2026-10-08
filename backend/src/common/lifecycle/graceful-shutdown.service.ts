import { BeforeApplicationShutdown, Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { RedisService } from '../../modules/redis/redis.service';
import type { RedisLifecycle } from '../../modules/redis/redis.ports';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { shutdownTracing } from '../../tracing';

/**
 * Orders shutdown (Render sends SIGTERM on every deploy / spin-down).
 * Nest runs: onModuleDestroy → beforeApplicationShutdown → HTTP server close
 * (waits for in-flight requests) → onApplicationShutdown. So:
 *   1. before: complete SSE streams, otherwise open event streams keep the
 *      HTTP server from closing;
 *   2. after the server closed: Redis, then Prisma, then flush OTel.
 * Requires app.enableShutdownHooks() in main.ts.
 */
@Injectable()
export class GracefulShutdownService implements BeforeApplicationShutdown, OnApplicationShutdown {
  private readonly logger = new Logger('Shutdown');

  constructor(
    @Inject(RedisService) private readonly redis: RedisLifecycle,
    private readonly prisma: PrismaService,
  ) {}

  beforeApplicationShutdown(signal?: string) {
    this.logger.log(`Shutting down${signal ? ` (${signal})` : ''}: closing SSE streams`);
    this.redis.completeStreams();
  }

  async onApplicationShutdown(_signal?: string) {
    await this.step('Redis', () => this.redis.close());
    await this.step('Prisma', () => this.prisma.$disconnect());
    await this.step('OpenTelemetry', () => shutdownTracing());
    this.logger.log('Shutdown complete');
  }

  private async step(name: string, fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`${name} shutdown failed: ${(err as Error).message}`);
    }
  }
}
