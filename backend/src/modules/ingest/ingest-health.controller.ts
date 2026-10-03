import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { IngestStatusService } from './ingest-status.service';
import { SKIP_ALL_THROTTLERS } from '../../common/throttle/throttle.config';

export const HEALTH_MEMO_MS = 10_000;
type Row = { election_id: string; shard: string; source: string | null; lease_expires_at: Date | null; last_applied_at: Date | null; lag_s: number | null;
  rejected_seats: number; refused_5m: number; tally_mismatch: boolean };

/**
 * Spec §4.6: public-safe feed health for an uptime monitor (no seat names, no keys, no lease holder). Never throttled, like the
 * other health routes, so the response is memoised for 10 s in-process (one status computation per instance per 10 s at most).
 */
@Controller('health')
@SkipThrottle(SKIP_ALL_THROTTLERS)
export class IngestHealthController {
  private memo: { at: number; rows: Promise<Row[]> } | null = null;
  constructor(private readonly prisma: PrismaService, private readonly status: IngestStatusService) {}

  @Get('ingest')
  ingest(): Promise<Row[]> { return this.memoised(Date.now()); }

  memoised(now: number): Promise<Row[]> {
    if (this.memo && now - this.memo.at < HEALTH_MEMO_MS) return this.memo.rows;
    const rows = this.compute();
    this.memo = { at: now, rows };
    rows.catch(() => { if (this.memo?.rows === rows) this.memo = null; }); // a failure is not cached
    return rows;
  }

  private async compute(): Promise<Row[]> {
    const out: Row[] = [];
    for (const e of await this.prisma.elections.findMany({ where: { status: 'Live' }, select: { id: true } })) {
      for (const s of (await this.status.status(e.id)).shards) {
        out.push({ election_id: e.id, shard: s.name, source: s.source, lease_expires_at: s.lease_expires_at,
          last_applied_at: s.last_applied_at, lag_s: s.lag_s, rejected_seats: s.rejected.length,
          refused_5m: Object.values(s.refused).reduce((a, n) => a + n, 0), tally_mismatch: !!s.tally_mismatch?.length });
      }
    }
    return out;
  }
}
