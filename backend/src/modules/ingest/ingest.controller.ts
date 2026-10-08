import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IngestKeyGuard } from './ingest-key.guard';
import { IngestService } from './ingest.service';
import { LeaseService } from './lease.service';
import { LeaseBody, SeatsBody, TallyBody } from './dto/ingest.dto';
import { REST, ShardsService } from './shards.service';
import { IngestNoLeaseException } from '../../common/exceptions';
import { SKIP_ALL_THROTTLERS } from '../../common/throttle/throttle.config';
import { AuditLogService } from '../audit-log/audit-log.service';

/** Spec §4: machine-key routes. Not admin JWTs; every response is no-store (Authorization header). */
@Controller('ingest/elections/:electionId')
@UseGuards(IngestKeyGuard)
@SkipThrottle(SKIP_ALL_THROTTLERS)
export class IngestController {
  constructor(
    private readonly ingest: IngestService, private readonly leases: LeaseService, private readonly shards: ShardsService,
    /** Never throws (a failed audit row must not fail the claim). */
    private readonly audit: AuditLogService,
  ) {}

  @Get('roster')
  roster(@Param('electionId', ParseUUIDPipe) id: string, @Query('shard') shard?: string) {
    return this.ingest.roster(id, shard || undefined);
  }

  @Get('config')
  config(@Param('electionId', ParseUUIDPipe) id: string, @Query('shard') shard?: string) {
    return this.ingest.config(id, shard || REST);
  }

  @Post('lease')
  @HttpCode(200)
  async lease(@Param('electionId', ParseUUIDPipe) id: string, @Body() body: LeaseBody, @Req() req: any) {
    await this.shards.get(id, body.shard); // unknown shard: 404, not 409
    const r = await this.leases.claim(id, body.shard, req.ingestKey.id, body.holder);
    if (!r.ok) throw new IngestNoLeaseException(r.expires_at);
    // A lease changing hands (failover after expiry, or after a release) is normal but must be visible: audit + Feed alert.
    if (r.previous) {
      await this.audit.log({ userId: null, action: 'INGEST_LEASE_TAKEOVER', entityType: 'election', entityId: id,
        oldValue: { shard: body.shard, holder: r.previous.holder, key_id: r.previous.key_id, expires_at: r.previous.expires_at },
        newValue: { shard: body.shard, holder: body.holder, key_id: req.ingestKey.id } });
    }
    return { expires_at: r.expires_at };
  }

  @Delete('lease')
  async release(@Param('electionId', ParseUUIDPipe) id: string, @Query('shard') shard: string, @Query('holder') holder: string, @Req() req: any) {
    await this.leases.release(id, shard || REST, req.ingestKey.id, holder ?? '');
    return { released: true };
  }

  @Post('seats')
  @HttpCode(200)
  seats(@Param('electionId', ParseUUIDPipe) id: string, @Body() body: SeatsBody, @Req() req: any) {
    return this.ingest.ingestSeats(id, req.ingestKey, body);
  }

  @Post('tally')
  @HttpCode(200)
  tally(@Param('electionId', ParseUUIDPipe) id: string, @Body() body: TallyBody, @Req() req: any) {
    return this.ingest.tally(id, req.ingestKey, body);
  }
}
