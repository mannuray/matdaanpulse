import { IdParamPipe } from '../../common/validation/id-param.pipe';
import { CONST_ID_MAX, CONST_ID_RE, SHARD_NAME_RE } from '../../common/validation/ids';
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
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
    /** Never throws: the change has committed, a failed audit row must not turn it into a 500 (and a retry). */
    private readonly audit: AuditLogService,
  ) {}

  @Get('elections/:id/ingest') @Roles('SUPER_ADMIN', 'EDITOR')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.status.status(id); }

  @Put('elections/:id/ingest') @Roles('SUPER_ADMIN', 'EDITOR')
  async put(@Param('id', ParseUUIDPipe) id: string, @Body() b: FeedSettingsBody, @Req() req: any) {
    const data = { active_source: b.active_source ?? null, hold_minutes: b.hold_minutes, updated_at: new Date(), updated_by: req.user?.id ?? null };
    await this.prisma.election_ingest.upsert({ where: { election_id: id }, create: { election_id: id, ...data }, update: data });
    await this.audit.log({ userId: req.user?.id ?? null, action: 'INGEST_FEED_UPDATE', entityType: 'election', entityId: id, newValue: data });
    return this.status.status(id);
  }

  @Get('elections/:id/ingest/sources') @Roles('SUPER_ADMIN', 'EDITOR')
  async sources(@Param('id', ParseUUIDPipe) id: string) {
    const rows = await this.prisma.ingest_log.findMany({ where: { election_id: id, received_at: { gte: new Date(Date.now() - 7 * 86_400_000) } }, distinct: ['source'], select: { source: true } });
    return rows.map(r => r.source).sort();
  }

  @Put('elections/:id/ingest/shards/:name') @Roles('SUPER_ADMIN', 'EDITOR')
  async putShard(@Param('id', ParseUUIDPipe) id: string, @Param('name', new IdParamPipe(SHARD_NAME_RE, 40, 'shard name')) name: string, @Body() b: ShardBody, @Req() req: any) {
    const out = await this.shards.upsert(id, name, { selector: b.selector, source_override: b.source_override ?? null });
    await this.audit.log({ userId: req.user?.id ?? null, action: 'INGEST_SHARD_UPDATE', entityType: 'election', entityId: id,
      newValue: { shard: name, selector: b.selector, source_override: b.source_override ?? null } });
    return out;
  }

  @Delete('elections/:id/ingest/shards/:name') @Roles('SUPER_ADMIN', 'EDITOR')
  async delShard(@Param('id', ParseUUIDPipe) id: string, @Param('name', new IdParamPipe(SHARD_NAME_RE, 40, 'shard name')) name: string, @Req() req: any) {
    await this.shards.remove(id, name);
    await this.audit.log({ userId: req.user?.id ?? null, action: 'INGEST_SHARD_DELETE', entityType: 'election', entityId: id, oldValue: { shard: name } });
    return { deleted: true };
  }

  @Get('elections/:id/holds') @Roles('SUPER_ADMIN', 'EDITOR')
  listHolds(@Param('id', ParseUUIDPipe) id: string) { return this.holds.list(id); }

  @Delete('elections/:id/holds/:constId') @Roles('SUPER_ADMIN', 'EDITOR')
  async release(@Param('id', ParseUUIDPipe) id: string, @Param('constId', new IdParamPipe(CONST_ID_RE, CONST_ID_MAX, 'constituency id')) constId: string, @Req() req: any) {
    await this.holds.release(id, constId);
    await this.audit.log({ userId: req.user?.id ?? null, action: 'INGEST_HOLD_RELEASE', entityType: 'constituency', entityId: constId, newValue: { election_id: id } });
    return { released: true };
  }

  @Put('elections/:id/seats/:constId') @Roles('SUPER_ADMIN', 'EDITOR')
  correct(@Param('id', ParseUUIDPipe) id: string, @Param('constId', new IdParamPipe(CONST_ID_RE, CONST_ID_MAX, 'constituency id')) constId: string, @Body() b: SeatCorrectionBody, @Req() req: any) {
    return this.correction.correct(id, constId, { state: b.state, round: b.round ?? null, votes: b.votes }, req.user?.id ?? null);
  }

  @Get('ingest-keys') @Roles('SUPER_ADMIN')
  listKeys() { return this.keys.list(); }

  @Post('ingest-keys') @HttpCode(201) @Roles('SUPER_ADMIN')
  async createKey(@Body() b: IngestKeyBody, @Req() req: any) {
    const out = await this.keys.create(b.name, req.user?.id ?? null, { electionId: b.election_id, expiresAt: b.expires_at ? new Date(b.expires_at) : undefined });
    await this.audit.log({ userId: req.user?.id ?? null, action: 'INGEST_KEY_CREATE', entityType: 'ingest_key', entityId: out.row.id,
      newValue: { name: b.name, election_id: b.election_id, expires_at: out.row.expires_at } });
    return out;
  }

  @Delete('ingest-keys/:keyId') @Roles('SUPER_ADMIN')
  async revokeKey(@Param('keyId', ParseUUIDPipe) keyId: string, @Req() req: any) {
    await this.keys.revoke(keyId);
    await this.audit.log({ userId: req.user?.id ?? null, action: 'INGEST_KEY_REVOKE', entityType: 'ingest_key', entityId: keyId });
    return { revoked: true };
  }
}
