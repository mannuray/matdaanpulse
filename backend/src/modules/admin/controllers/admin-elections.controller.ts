import { Controller, Post, Patch, Get, Put, Body, Param, UseGuards, ParseUUIDPipe, Req, Logger } from '@nestjs/common';
import { ElectionsService } from '../../elections/elections.service';
import { ManifestsService } from '../../manifests/manifests.service';
import { ResultsService } from '../../results/results.service';
import { LiveStateService } from '../../results/live-state.service';
import { SeatAnalysisService } from '../../constituencies/seat-analysis.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateElectionDto, UpdateElectionDto } from '../../elections/dto/election-input.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminElectionsController {
  private readonly logger = new Logger(AdminElectionsController.name);

  constructor(
    private readonly electionsService: ElectionsService,
    private readonly manifestsService: ManifestsService,
    private readonly resultsService: ResultsService,
    private readonly liveState: LiveStateService,
    private readonly seatAnalysis: SeatAnalysisService,
  ) {}

  /** Going Live stores the pre-counting baseline (decided 2026-10-07); a failure is logged, the update stands. */
  private async computeIfLive(id: string, before: string, after: string): Promise<void> {
    if (after !== 'Live' || before === 'Live') return;
    try { await this.seatAnalysis.computeBaseline(id); } catch (e) { this.logger.error(`baseline for ${id} failed: ${(e as Error).message}`); }
  }

  /** Finalizing stores the final seat analysis (spec 2026-10-07-seat-analysis-design.md §4.5); a failure is logged, the finalize stands. */
  private async computeIfFinalized(id: string, before: string, after: string): Promise<void> {
    if (after !== 'Finalized' || before === 'Finalized') return;
    try { await this.seatAnalysis.compute(id); } catch (e) { this.logger.error(`seat analysis for ${id} failed: ${(e as Error).message}`); }
  }

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
    const before = await this.electionsService.findOne(id);
    const updated = await this.electionsService.update(id, body);
    await this.computeIfFinalized(id, String(before.status), String(body.status ?? before.status));
    await this.computeIfLive(id, String(before.status), String(body.status ?? before.status));
    return this.afterElectionChange(id, updated);
  }

  @Post('elections/:id/finalize')
  @Roles('SUPER_ADMIN')
  async finalizeElection(@Param('id', ParseUUIDPipe) id: string) {
    const before = await this.electionsService.findOne(id);
    const finalized = await this.electionsService.finalize(id);
    await this.computeIfFinalized(id, String(before.status), 'Finalized');
    return this.afterElectionChange(id, finalized);
  }

  @Post('elections/:id/reopen')
  @Roles('SUPER_ADMIN')
  async reopenElection(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const reopened = await this.electionsService.reopen(id, req.user?.id ?? null);
    await this.computeIfLive(id, 'Finalized', 'Live');
    return this.afterElectionChange(id, reopened);
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
