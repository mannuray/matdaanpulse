import { Controller, Post, Patch, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ElectionsService } from '../../elections/elections.service';
import { ManifestsService } from '../../manifests/manifests.service';
import { ResultsService } from '../../results/results.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminElectionsController {
  constructor(
    private readonly electionsService: ElectionsService,
    private readonly manifestsService: ManifestsService,
    private readonly resultsService: ResultsService,
  ) {}

  @Post('elections')
  @Roles('SUPER_ADMIN', 'EDITOR')
  createElection(@Body() body: { name: string; type: 'LS' | 'VS'; state_id?: number; year: number }) {
    return this.electionsService.create(body);
  }

  @Patch('elections/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  updateElection(@Param('id') id: string, @Body() body: any) {
    return this.electionsService.update(id, body);
  }

  @Post('elections/:id/finalize')
  @Roles('SUPER_ADMIN')
  finalizeElection(@Param('id') id: string) {
    return this.electionsService.finalize(id);
  }

  @Get('elections/:id/manifest')
  @Roles('SUPER_ADMIN', 'EDITOR')
  getManifest(@Param('id') id: string) {
    return this.manifestsService.getManifest(id);
  }

  @Put('elections/:id/manifest')
  @Roles('SUPER_ADMIN', 'EDITOR')
  saveManifestDraft(@Param('id') id: string, @Body() body: object) {
    return this.manifestsService.saveDraft(id, body);
  }

  @Get('elections/:id/live-results')
  @Roles('SUPER_ADMIN', 'EDITOR')
  getLiveResults(@Param('id') id: string) {
    return this.resultsService.getLiveResults(id);
  }

  @Post('elections/:id/manifest/publish')
  @Roles('SUPER_ADMIN')
  publishManifest(@Param('id') id: string) {
    return this.manifestsService.publish(id);
  }
}
