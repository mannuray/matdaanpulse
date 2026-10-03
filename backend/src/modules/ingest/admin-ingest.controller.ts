import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { IngestStatusService } from './ingest-status.service';
import { ShardsService } from './shards.service';
import { HoldsService } from './holds.service';
import { SeatCorrectionService } from './seat-correction.service';
import { IngestKeysService } from './ingest-keys.service';
import { FeedSettingsBody, IngestKeyBody, SeatCorrectionBody, ShardBody } from './dto/admin-ingest.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminIngestController {
  constructor(
    private readonly prisma: PrismaService, private readonly status: IngestStatusService, private readonly shards: ShardsService,
    private readonly holds: HoldsService, private readonly correction: SeatCorrectionService, private readonly keys: IngestKeysService,
  ) {}

  @Get('elections/:id/ingest') @Roles('SUPER_ADMIN', 'EDITOR')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.status.status(id); }

  @Put('elections/:id/ingest') @Roles('SUPER_ADMIN', 'EDITOR')
  async put(@Param('id', ParseUUIDPipe) id: string, @Body() b: FeedSettingsBody, @Req() req: any) {
    const data = { active_source: b.active_source ?? null, hold_minutes: b.hold_minutes, updated_at: new Date(), updated_by: req.user?.id ?? null };
    await this.prisma.election_ingest.upsert({ where: { election_id: id }, create: { election_id: id, ...data }, update: data });
    await this.prisma.audit_logs.create({ data: { user_id: req.user?.id ?? null, action: 'INGEST_FEED_UPDATE', entity_type: 'election', entity_id: id, new_value: data as any } });
    return this.status.status(id);
  }

  @Get('elections/:id/ingest/sources') @Roles('SUPER_ADMIN', 'EDITOR')
  async sources(@Param('id', ParseUUIDPipe) id: string) {
    const rows = await this.prisma.ingest_log.findMany({ where: { election_id: id, received_at: { gte: new Date(Date.now() - 7 * 86_400_000) } }, distinct: ['source'], select: { source: true } });
    return rows.map(r => r.source).sort();
  }

  @Put('elections/:id/ingest/shards/:name') @Roles('SUPER_ADMIN', 'EDITOR')
  putShard(@Param('id', ParseUUIDPipe) id: string, @Param('name') name: string, @Body() b: ShardBody) {
    return this.shards.upsert(id, name, { selector: b.selector, source_override: b.source_override ?? null });
  }

  @Delete('elections/:id/ingest/shards/:name') @Roles('SUPER_ADMIN', 'EDITOR')
  async delShard(@Param('id', ParseUUIDPipe) id: string, @Param('name') name: string) { await this.shards.remove(id, name); return { deleted: true }; }

  @Get('elections/:id/holds') @Roles('SUPER_ADMIN', 'EDITOR')
  listHolds(@Param('id', ParseUUIDPipe) id: string) { return this.holds.list(id); }

  @Delete('elections/:id/holds/:constId') @Roles('SUPER_ADMIN', 'EDITOR')
  async release(@Param('id', ParseUUIDPipe) id: string, @Param('constId') constId: string) { await this.holds.release(id, constId); return { released: true }; }

  @Put('elections/:id/seats/:constId') @Roles('SUPER_ADMIN', 'EDITOR')
  correct(@Param('id', ParseUUIDPipe) id: string, @Param('constId') constId: string, @Body() b: SeatCorrectionBody, @Req() req: any) {
    return this.correction.correct(id, constId, { state: b.state, round: b.round ?? null, votes: b.votes }, req.user?.id ?? null);
  }

  @Get('ingest-keys') @Roles('SUPER_ADMIN')
  listKeys() { return this.keys.list(); }

  @Post('ingest-keys') @HttpCode(201) @Roles('SUPER_ADMIN')
  async createKey(@Body() b: IngestKeyBody, @Req() req: any) {
    const out = await this.keys.create(b.name, req.user?.id ?? null);
    await this.prisma.audit_logs.create({ data: { user_id: req.user?.id ?? null, action: 'INGEST_KEY_CREATE', entity_type: 'ingest_key', entity_id: out.row.id, new_value: { name: b.name } } });
    return out;
  }

  @Delete('ingest-keys/:keyId') @Roles('SUPER_ADMIN')
  async revokeKey(@Param('keyId', ParseUUIDPipe) keyId: string, @Req() req: any) {
    await this.keys.revoke(keyId);
    await this.prisma.audit_logs.create({ data: { user_id: req.user?.id ?? null, action: 'INGEST_KEY_REVOKE', entity_type: 'ingest_key', entity_id: keyId } });
    return { revoked: true };
  }
}
