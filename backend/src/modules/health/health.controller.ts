import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // Database
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
    } catch (e) {
      checks.database = { status: 'unhealthy', latencyMs: Date.now() - dbStart, error: (e as Error).message };
    }

    // Redis
    const redisStart = Date.now();
    try {
      await this.redis.get('health:ping');
      checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart };
    } catch (e) {
      checks.redis = { status: 'unhealthy', latencyMs: Date.now() - redisStart, error: (e as Error).message };
    }

    const overall = Object.values(checks).every(c => c.status === 'healthy') ? 'healthy' : 'degraded';

    return {
      status: overall,
      checks,
      uptimeSeconds: Math.round((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
