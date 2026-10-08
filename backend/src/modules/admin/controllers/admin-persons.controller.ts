import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { PersonsService } from '../../candidates/persons.service';
import { PersonMergeService } from '../../candidates/person-merge.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminPersonDto } from '../dto/admin-response.dto';
import { CreatePersonDto, UpdatePersonDto, MergePersonsDto } from '../../candidates/dto/person-input.dto';
import { AdminPersonsQueryDto, PersonSearchQueryDto } from '../../../common/dto/query.dto';

@Controller('admin/persons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPersonsController {
  constructor(
    private readonly personsService: PersonsService,
    private readonly merges: PersonMergeService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'EDITOR')
  findAllPersons(@Query() { q, page, limit, state_id, region_id, contests }: AdminPersonsQueryDto) {
    return this.personsService.findAll(page ?? 1, limit ?? 100, q || '', { state_id, region_id, contests });
  }

  @Get('search')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPersonDto))
  async searchPersons(@Query() { q }: PersonSearchQueryDto) {
    // Too short to mean anything (the admin picker waits for 2 characters): no rows, rather than 50 arbitrary persons.
    if (q.length < 2) return [];
    return this.personsService.search(q);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPersonDto))
  async findPersonDetail(@Param('id', ParseUUIDPipe) id: string) {
    const [person, last_edit] = await Promise.all([
      this.personsService.findWithCandidates(id),
      this.audit.lastEdit('person', id),
    ]);
    const merges = await this.merges.mergeHistory(id, person.candidates.map((c) => c.id));
    return { ...person, last_edit, merges };
  }

  @Post()
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPersonDto))
  createPerson(@Body() body: CreatePersonDto) {
    return this.personsService.create(body);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPersonDto))
  async updatePerson(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePersonDto) {
    const person = await this.personsService.update(id, body, req.user?.id);
    return { ...person, last_edit: await this.audit.lastEdit('person', id) };
  }

  @Post('merge')
  @Roles('SUPER_ADMIN')
  mergePersons(@Req() req: any, @Body() body: MergePersonsDto) {
    return this.merges.merge(body.source_id, body.target_id, req.user?.id);
  }

  @Post('merges/:id/undo')
  @Roles('SUPER_ADMIN')
  undoMerge(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.merges.undoMerge(id, req.user?.id);
  }
}
