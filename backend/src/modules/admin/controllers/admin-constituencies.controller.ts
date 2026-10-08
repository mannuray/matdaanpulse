import { Controller, Get, Patch, Post, Body, Param, Query, Req, UseGuards, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { ConstituenciesService } from '../../constituencies/constituencies.service';
import { SeatAnalysisService } from '../../constituencies/seat-analysis.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminConstituencyDto, AdminAnalysisDto, AdminSeatHistoryDto } from '../dto/admin-response.dto';
import {
  UpdateConstituencyDto, BulkTagDto, UpdateAnalysisDto,
} from '../../constituencies/dto/constituency-input.dto';
import { AdminConstituenciesQueryDto } from '../../../common/dto/query.dto';

@Controller('admin/constituencies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminConstituenciesController {
  constructor(
    private readonly constituenciesService: ConstituenciesService,
    private readonly audit: AuditLogService,
    private readonly seatAnalysis: SeatAnalysisService,
  ) {}

  @Get('list/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  getConstituencies(
    @Param('electionId', ParseUUIDPipe) electionId: string,
    @Query() { page, limit, q }: AdminConstituenciesQueryDto,
  ) {
    return this.constituenciesService.findByElectionWithAnalysis(electionId, page ?? 1, limit ?? 100, q);
  }

  @Get('detail/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  async getConstituencyDetail(@Param('id') id: string) {
    const [constituency, last_edit] = await Promise.all([
      this.constituenciesService.findOneWithAnalysis(id),
      this.audit.lastEdit('constituency', id),
    ]);
    return { ...constituency, last_edit };
  }

  /** Winners of this seat across elections (results, not constituency_analysis), newest first. */
  @Get(':id/history')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminSeatHistoryDto))
  history(@Param('id') id: string) {
    return this.constituenciesService.history(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  async updateConstituency(@Req() req: any, @Param('id') id: string, @Body() body: UpdateConstituencyDto) {
    const constituency = await this.constituenciesService.updateConstituency(id, body, req.user?.id);
    return { ...constituency, last_edit: await this.audit.lastEdit('constituency', id) };
  }

  @Patch(':id/metadata')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  async updateMetadata(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const constituency = await this.constituenciesService.updateMetadata(id, body, req.user?.id);
    return { ...constituency, last_edit: await this.audit.lastEdit('constituency', id) };
  }

  @Post('bulk-tag')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  bulkTag(@Req() req: any, @Body() body: BulkTagDto) {
    return this.constituenciesService.bulkTag(body.ids, body.add_tags, body.remove_tags, req.user?.id);
  }

  @Get('analysis/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  getAnalysis(@Param('electionId', ParseUUIDPipe) electionId: string) {
    return this.constituenciesService.getAnalysis(electionId);
  }

  @Post('analysis/compute/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  async computeAnalysis(@Param('electionId', ParseUUIDPipe) electionId: string, @Req() req: any) {
    const out = await this.seatAnalysis.computeFor(electionId);
    await this.audit.log({ userId: req.user?.id, action: 'ANALYSIS_COMPUTE', entityType: 'election', entityId: electionId, newValue: out });
    return out;
  }

  @Patch('analysis/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  updateAnalysis(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAnalysisDto, @Req() req: any) {
    return this.constituenciesService.updateAnalysis(id, body, req.user?.id);
  }
}
