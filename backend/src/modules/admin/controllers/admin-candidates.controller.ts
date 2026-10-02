import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { CandidatesService } from '../../candidates/candidates.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminCandidateDto, AdminCandidateResultDto } from '../dto/admin-response.dto';
import { CreateCandidateDto, UpdateCandidateDto, LinkPersonDto } from '../../candidates/dto/candidate-input.dto';

@Controller('admin/candidates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminCandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  findAll(
    @Query('election_id') election_id?: string,
    @Query('const_id') const_id?: string,
  ) {
    return this.candidatesService.findAll({ election_id, const_id }, undefined, true);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const [candidate, last_edit] = await Promise.all([
      this.candidatesService.findOne(id),
      this.audit.lastEdit('candidate', id),
    ]);
    // The Master record card's "N contests · first YYYY" for the candidate's person.
    const person_contests = candidate.person_id ? await this.candidatesService.personContests(candidate.person_id) : null;
    return { ...candidate, last_edit, person_contests };
  }

  /** Read-only result strip and the other candidates of the seat. */
  @Get(':id/result')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateResultDto))
  result(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.seatResult(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  async create(@Req() req: any, @Body() body: CreateCandidateDto) {
    const candidate = await this.candidatesService.create(body, req.user?.id);
    return { ...candidate, last_edit: await this.audit.lastEdit('candidate', candidate.id) };
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  async update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCandidateDto) {
    const candidate = await this.candidatesService.update(id, body, req.user?.id);
    return { ...candidate, last_edit: await this.audit.lastEdit('candidate', id) };
  }

  /** Change person: move this candidacy to another existing person. */
  @Put(':id/person')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  async changePerson(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: LinkPersonDto) {
    const candidate = await this.candidatesService.changePerson(id, body.person_id, req.user?.id);
    return { ...candidate, last_edit: await this.audit.lastEdit('candidate', id) };
  }

  /** The older name of change person, still called by the admin's linkCandidatePerson. */
  @Put(':id/link-person')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminCandidateDto))
  linkPerson(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: LinkPersonDto) {
    return this.changePerson(req, id, body);
  }

  /** Split: move this candidacy to a new person created from it. Returns the new person's id. */
  @Post(':id/split')
  @Roles('SUPER_ADMIN', 'EDITOR')
  split(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.split(id, req.user?.id);
  }
}
