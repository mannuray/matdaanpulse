import { Controller, Delete, Get, Post, Put, Body, Param, Query, UseGuards, UseInterceptors, HttpCode } from '@nestjs/common';
import { CandidatesService } from '../../candidates/candidates.service';
import { AiEnrichmentService } from '../../ai/ai-enrichment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { candidates as Candidate } from '@prisma/client';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminCandidateDto } from '../dto/admin-response.dto';

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
  findOne(@Param('id') id: string) {
    return this.candidatesService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  create(@Body() body: Partial<Candidate>) {
    return this.candidatesService.create(body);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  update(@Param('id') id: string, @Body() body: Partial<Candidate>) {
    return this.candidatesService.update(id, body);
  }

  @Put(':id/link-person')
  @Roles('SUPER_ADMIN', 'EDITOR')
  linkPerson(@Param('id') id: string, @Body() body: { person_id: string }) {
    return this.candidatesService.linkPerson(id, body.person_id);
  }

  @Delete(':id/link-person')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @HttpCode(204)
  async unlinkPerson(@Param('id') id: string) {
    await this.candidatesService.unlinkPerson(id);
  }

  @Post('enrich/:electionId')
  @Roles('SUPER_ADMIN')
  enrichCandidates(@Param('electionId') electionId: string) {
    return this.aiService.enrichCandidates(electionId);
  }
}
