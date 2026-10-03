import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { IngestStatusService } from './ingest-status.service';
import { SKIP_ALL_THROTTLERS } from '../../common/throttle/throttle.config';

/** Spec §4.6: public-safe feed health for an uptime monitor (no seat names, no keys). Never throttled, like the other health routes. */
@Controller('health')
@SkipThrottle(SKIP_ALL_THROTTLERS)
export class IngestHealthController {
  constructor(private readonly prisma: PrismaService, private readonly status: IngestStatusService) {}

  @Get('ingest')
  async ingest() {
    const out = [];
    for (const e of await this.prisma.elections.findMany({ where: { status: 'Live' }, select: { id: true } })) {
      for (const s of (await this.status.status(e.id)).shards) {
        out.push({ election_id: e.id, shard: s.name, source: s.source, lease_holder: s.lease_holder, lease_expires_at: s.lease_expires_at,
          last_applied_at: s.last_applied_at, lag_s: s.lag_s, rejected_seats: s.rejected.length, tally_mismatch: !!s.tally_mismatch?.length });
      }
    }
    return out;
  }
}
