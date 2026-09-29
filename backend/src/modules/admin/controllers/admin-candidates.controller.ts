import { Controller, Delete, Get, Post, Put, Body, Param, Query, UseGuards, UseInterceptors, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { CandidatesService } from '../../candidates/candidates.service';
import { AiEnrichmentService } from '../../ai/ai-enrichment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminCandidateDto } from '../dto/admin-response.dto';
import { CreateCandidateDto, UpdateCandidateDto, LinkPersonDto, EnrichCandidatesDto } from '../dto/admin-input.dto';

@Controller('admin/candidates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminCandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly aiService: AiEnrichmentService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  findAll(
    @Query('election_id') election_id?: string,
    @Query('const_id') const_id?: string,
  ) {
    return this.candidatesService.findAll({ election_id, const_id });
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  create(@Body() body: CreateCandidateDto) {
    return this.candidatesService.create(body);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCandidateDto) {
    return this.candidatesService.update(id, body);
  }

  @Put(':id/link-person')
  @Roles('SUPER_ADMIN', 'EDITOR')
  linkPerson(@Param('id', ParseUUIDPipe) id: string, @Body() body: LinkPersonDto) {
    return this.candidatesService.linkPerson(id, body.person_id);
  }

  @Delete(':id/link-person')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @HttpCode(204)
  async unlinkPerson(@Param('id', ParseUUIDPipe) id: string) {
    await this.candidatesService.unlinkPerson(id);
  }

  @Post('enrich/:electionId')
  @Roles('SUPER_ADMIN')
  enrichCandidates(
    @Param('electionId', ParseUUIDPipe) electionId: string,
    @Body() body?: EnrichCandidatesDto,
  ) {
    return this.aiService.enrichCandidates(electionId, body?.candidate_ids);
  }

  @Get('enrich/status/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  getEnrichmentStatus(@Param('electionId', ParseUUIDPipe) electionId: string) {
    return this.aiService.getProgress(`candidates_${electionId}`);
  }
}
