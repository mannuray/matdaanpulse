import { Controller, Post, Patch, Get, Put, Body, Param, UseGuards, ParseUUIDPipe, Req } from '@nestjs/common';
import { ElectionsService } from '../../elections/elections.service';
import { ManifestsService } from '../../manifests/manifests.service';
import { ResultsService } from '../../results/results.service';
import { LiveStateService } from '../../results/live-state.service';
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
    private readonly liveState: LiveStateService,
  ) {}

  /** Status is part of GET /elections/:id/live: show a change at once (the version does not move). */
  private async afterElectionChange<T>(id: string, result: T): Promise<T> {
    this.liveState.invalidate(id);
    await this.resultsService.purgeElectionCache(id);
    return result;
  }

  @Post('elections')
  @Roles('SUPER_ADMIN', 'EDITOR')
  createElection(@Body() body: CreateElectionDto) {
    return this.electionsService.create(body);
  }

  @Patch('elections/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  async updateElection(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateElectionDto) {
    return this.afterElectionChange(id, await this.electionsService.update(id, body));
  }

  @Post('elections/:id/finalize')
  @Roles('SUPER_ADMIN')
  async finalizeElection(@Param('id', ParseUUIDPipe) id: string) {
    return this.afterElectionChange(id, await this.electionsService.finalize(id));
  }

  @Post('elections/:id/reopen')
  @Roles('SUPER_ADMIN')
  async reopenElection(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.afterElectionChange(id, await this.electionsService.reopen(id, req.user?.id ?? null));
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
