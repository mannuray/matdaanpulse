import { Controller, Post, Patch, Get, Put, Body, Param, UseGuards, ParseUUIDPipe, Req } from '@nestjs/common';
import { ManifestDraftDto, manifestDraftToJson } from '../../manifests/dto/manifest-draft.dto';
import { ValidationFailedException } from '../../../common/validation/validation-failed.exception';
import { ElectionsService } from '../../elections/elections.service';
import { ManifestsService } from '../../manifests/manifests.service';
import { ResultsService } from '../../results/results.service';
import { ElectionLifecycleService, type ElectionStatus } from '../election-lifecycle.service';
import { ElectionNotFinalizedException } from '../../../common/exceptions';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateElectionDto, UpdateElectionDto } from '../../elections/dto/election-input.dto';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { changedFields, createdFields } from '../../audit-log/audit-diff';

const pick = (row: object, keys: string[]) => Object.fromEntries(keys.map((k) => [k, (row as Record<string, unknown>)[k]]));

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminElectionsController {
  constructor(
    private readonly electionsService: ElectionsService,
    private readonly manifestsService: ManifestsService,
    private readonly resultsService: ResultsService,
    /** Every status change goes through it: permissions, analysis, audit, caches. */
    private readonly lifecycle: ElectionLifecycleService,
    private readonly audit: AuditLogService,
  ) {}

  @Post('elections')
  @Roles('SUPER_ADMIN', 'EDITOR')
  async createElection(@Body() body: CreateElectionDto, @Req() req: any) {
    const election = await this.electionsService.create(body);
    await this.audit.log({
      userId: req.user?.id, action: 'ELECTION_CREATE', entityType: 'election', entityId: election.id,
      newValue: createdFields(election as unknown as Record<string, unknown>),
    });
    return election;
  }

  @Patch('elections/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  async updateElection(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateElectionDto, @Req() req: any) {
    const { status, ...fields } = body;
    // The status change first: a refused one (e.g. an editor finalizing) saves nothing.
    let result = status ? await this.lifecycle.transition(id, status as ElectionStatus, req.user ?? {}) : null;
    if (Object.keys(fields).length) {
      // Status changes are audited by the lifecycle; this row covers the other fields, only those that changed.
      const before = await this.electionsService.findOne(id);
      const updated = await this.electionsService.update(id, fields);
      const keys = Object.keys(fields);
      const diff = changedFields(pick(before, keys), pick(updated, keys));
      if (diff) await this.audit.log({ userId: req.user?.id, action: 'ELECTION_UPDATE', entityType: 'election', entityId: id, ...diff });
      result = updated;
    }
    return result ?? this.electionsService.findOne(id);
  }

  @Post('elections/:id/finalize')
  @Roles('SUPER_ADMIN')
  finalizeElection(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.lifecycle.transition(id, 'Finalized', req.user ?? {});
  }

  /** A late correction after Finalize (spec §6): SUPER_ADMIN only, audited; Live again until re-finalized. */
  @Post('elections/:id/reopen')
  @Roles('SUPER_ADMIN')
  async reopenElection(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const election = await this.electionsService.findOne(id);
    if (election.status !== 'Finalized') throw new ElectionNotFinalizedException(id);
    return this.lifecycle.transition(id, 'Live', req.user ?? {});
  }

  @Get('elections/:id/manifest')
  @Roles('SUPER_ADMIN', 'EDITOR')
  getManifest(@Param('id', ParseUUIDPipe) id: string) {
    return this.manifestsService.getManifest(id);
  }

  @Put('elections/:id/manifest')
  @Roles('SUPER_ADMIN', 'EDITOR')
  async saveManifestDraft(@Param('id', ParseUUIDPipe) id: string, @Body() body: ManifestDraftDto, @Req() req: any) {
    // The ValidationPipe checks a JSON array element by element; a manifest is one object.
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationFailedException([{ field: 'body', message: 'manifest must be a JSON object' }]);
    }
    const out = await this.manifestsService.saveDraft(id, manifestDraftToJson(body));
    // A summary, not the draft itself (up to ~100 kb); the draft stays readable on the election until published.
    await this.audit.log({
      userId: req.user?.id, action: 'MANIFEST_SAVE', entityType: 'election', entityId: id,
      newValue: { keys: Object.keys(body).sort(), bytes: JSON.stringify(body).length },
    });
    return out;
  }

  @Get('elections/:id/live-results')
  @Roles('SUPER_ADMIN', 'EDITOR')
  getLiveResults(@Param('id', ParseUUIDPipe) id: string) {
    return this.resultsService.getLiveResults(id);
  }

  @Post('elections/:id/manifest/publish')
  @Roles('SUPER_ADMIN')
  async publishManifest(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const out = await this.manifestsService.publish(id);
    await this.audit.log({ userId: req.user?.id, action: 'MANIFEST_PUBLISH', entityType: 'election', entityId: id });
    return out;
  }
}
