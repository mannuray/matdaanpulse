import { Controller, Delete, Get, Post, Put, Body, Param, Query, Req, UseGuards, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { PersonsService } from '../../candidates/persons.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminPersonDto } from '../dto/admin-response.dto';
import { CreatePersonDto, UpdatePersonDto, MergePersonsDto } from '../../candidates/dto/person-input.dto';
import { AdminPersonsQueryDto } from '../../../common/dto/query.dto';

@Controller('admin/persons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPersonsController {
  constructor(
    private readonly personsService: PersonsService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'EDITOR')
  findAllPersons(@Query() { q, page, limit, state_id, region_id }: AdminPersonsQueryDto) {
    return this.personsService.findAll(page ?? 1, limit ?? 100, q || '', { state_id, region_id });
  }

  @Get('search')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPersonDto))
  searchPersons(@Query('q') q: string) {
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
    return { ...person, last_edit };
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
    return this.personsService.merge(body.source_id, body.target_id, req.user?.id);
  }

  @Post('auto-link')
  @Roles('SUPER_ADMIN')
  autoLink() {
    return this.personsService.autoLink();
  }
}
