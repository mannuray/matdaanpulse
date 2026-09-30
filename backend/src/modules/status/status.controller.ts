import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StatusService } from './status.service';
import { withTimeout } from '../../common/util/with-timeout';
import { buildProcessInfo, poolConfig } from './process-info';

export const STATUS_DB_TIMEOUT_MS = 2000;

@Controller('admin/status')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class StatusController {
  constructor(
    private readonly status: StatusService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async get() {
    const now = Date.now();
    const snap = this.status.snapshot(now);
    return {
      generatedAt: new Date(now).toISOString(),
      process: buildProcessInfo(this.status.startedAt, now),
      http: snap.http,
      cache: snap.cache,
      redis: { ...this.redis.connectionStates(), ...snap.redis },
      live: snap.live,
      db: await this.probeDb(),
    };
  }

  private async probeDb() {
    const start = Date.now();
    let ok = true;
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, STATUS_DB_TIMEOUT_MS, 'status db check');
    } catch {
      ok = false;
    }
    return { ok, latencyMs: Date.now() - start, pool: poolConfig(process.env.DATABASE_URL) };
  }
}
