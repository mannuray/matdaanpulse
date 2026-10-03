import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IngestKeyGuard } from './ingest-key.guard';
import { IngestService } from './ingest.service';
import { LeaseService } from './lease.service';
import { LeaseBody, SeatsBody, TallyBody } from './dto/ingest.dto';
import { REST, ShardsService } from './shards.service';
import { IngestNoLeaseException } from '../../common/exceptions';

/** Spec §4: machine-key routes. Not admin JWTs; every response is no-store (Authorization header). */
@Controller('ingest/elections/:electionId')
@UseGuards(IngestKeyGuard)
@SkipThrottle()
export class IngestController {
  constructor(private readonly ingest: IngestService, private readonly leases: LeaseService, private readonly shards: ShardsService) {}

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
    if (!r.ok) throw new IngestNoLeaseException(r.holder, r.expires_at);
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
