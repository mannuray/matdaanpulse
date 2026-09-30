import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { ConstituenciesService } from '../../constituencies/constituencies.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminConstituencyDto, AdminAnalysisDto } from '../dto/admin-response.dto';
import {
  UpdateConstituencyDto, BulkTagDto, ComputeAnalysisDto, UpdateAnalysisDto,
} from '../dto/admin-input.dto';
import { AdminConstituenciesQueryDto } from '../../../common/dto/query.dto';

@Controller('admin/constituencies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminConstituenciesController {
  constructor(private readonly constituenciesService: ConstituenciesService) {}

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
  getConstituencyDetail(@Param('id') id: string) {
    return this.constituenciesService.findOneWithAnalysis(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  updateConstituency(@Param('id') id: string, @Body() body: UpdateConstituencyDto) {
    return this.constituenciesService.updateConstituency(id, body);
  }

  @Patch(':id/metadata')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  updateMetadata(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.constituenciesService.updateMetadata(id, body);
  }

  @Post('bulk-tag')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminConstituencyDto))
  bulkTag(@Body() body: BulkTagDto) {
    return this.constituenciesService.bulkTag(body.ids, body.add_tags, body.remove_tags);
  }

  @Get('analysis/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  getAnalysis(@Param('electionId', ParseUUIDPipe) electionId: string) {
    return this.constituenciesService.getAnalysis(electionId);
  }

  @Post('analysis/compute/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  computeAnalysis(
    @Param('electionId', ParseUUIDPipe) electionId: string,
    @Body() body: ComputeAnalysisDto,
  ) {
    return this.constituenciesService.computeAnalysis(electionId, body.history_election_ids || [], body.manifest);
  }

  @Patch('analysis/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminAnalysisDto))
  updateAnalysis(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAnalysisDto) {
    return this.constituenciesService.updateAnalysis(id, body);
  }
}
