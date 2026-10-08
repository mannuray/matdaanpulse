import { Controller, Post, Patch, Get, Put, Body, Param, UseGuards, ParseUUIDPipe, Req } from '@nestjs/common';
import { ElectionsService } from '../../elections/elections.service';
import { ManifestsService } from '../../manifests/manifests.service';
import { ResultsService } from '../../results/results.service';
import { ElectionLifecycleService, type ElectionStatus } from '../election-lifecycle.service';
import { ElectionNotFinalizedException } from '../../../common/exceptions';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateElectionDto, UpdateElectionDto } from '../../elections/dto/election-input.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminElectionsController {
  constructor(
    private readonly electionsService: ElectionsService,
    private readonly manifestsService: ManifestsService,
    private readonly resultsService: ResultsService,
    /** Every status change goes through it: permissions, analysis, audit, caches. */
    private readonly lifecycle: ElectionLifecycleService,
  ) {}

  @Post('elections')
  @Roles('SUPER_ADMIN', 'EDITOR')
  createElection(@Body() body: CreateElectionDto) {
    return this.electionsService.create(body);
  }

  @Patch('elections/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  async updateElection(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateElectionDto, @Req() req: any) {
    const { status, ...fields } = body;
    // The status change first: a refused one (e.g. an editor finalizing) saves nothing.
    let result = status ? await this.lifecycle.transition(id, status as ElectionStatus, req.user ?? {}) : null;
    if (Object.keys(fields).length) result = await this.electionsService.update(id, fields);
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
  saveManifestDraft(@Param('id', ParseUUIDPipe) id: string, @Body() body: object) {
    return this.manifestsService.saveDraft(id, body);
  }

  @Get('elections/:id/live-results')
  @Roles('SUPER_ADMIN', 'EDITOR')
  getLiveResults(@Param('id', ParseUUIDPipe) id: string) {
    return this.resultsService.getLiveResults(id);
  }

  @Post('elections/:id/manifest/publish')
  @Roles('SUPER_ADMIN')
  publishManifest(@Param('id', ParseUUIDPipe) id: string) {
    return this.manifestsService.publish(id);
  }
}
