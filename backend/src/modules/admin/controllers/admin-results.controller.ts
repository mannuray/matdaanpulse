import { Controller, Patch, Post, Body, UseGuards, HttpCode, Logger, Req } from '@nestjs/common';
import { ResultOverrideService } from '../../live/result-override.service';
import { BulkOverrideService } from '../../live/bulk-override.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { OverridePayload, BulkOverridePayload } from '../../live/dto/result-override.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminResultsController {
  private readonly logger = new Logger(AdminResultsController.name);

  constructor(
    private readonly resultOverrideService: ResultOverrideService,
    private readonly bulkOverrideService: BulkOverrideService,
  ) {}

  @Patch('results/override')
  @Roles('SUPER_ADMIN', 'EDITOR')
  overrideResult(@Req() req: any, @Body() body: OverridePayload) {
    this.logger.debug(`Override by user=${req.user?.email ?? 'unknown'} result_id=${body.result_id}`);
    return this.resultOverrideService.override(body, req.user?.id);
  }

  @Post('results/override-bulk')
  @HttpCode(200)
  @Roles('SUPER_ADMIN', 'EDITOR')
  bulkOverride(@Req() req: any, @Body() body: BulkOverridePayload) {
    this.logger.log(
      `Bulk override by user=${req.user?.email ?? 'unknown'} election=${body.election_id} items=${body.overrides?.length ?? 0}`,
    );
    return this.bulkOverrideService.bulkOverride(body);
  }
}
