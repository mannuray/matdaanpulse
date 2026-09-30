import { Controller, Delete, Get, Post, Put, Body, Param, Query, UseGuards, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { PersonsService } from '../../candidates/persons.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminPersonDto } from '../dto/admin-response.dto';
import { CreatePersonDto, UpdatePersonDto, MergePersonsDto } from '../dto/admin-input.dto';
import { AdminPersonsQueryDto } from '../../../common/dto/query.dto';

@Controller('admin/persons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPersonsController {
  constructor(private readonly personsService: PersonsService) {}

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
  findPersonDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.personsService.findWithCandidates(id);
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
  updatePerson(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePersonDto) {
    return this.personsService.update(id, body);
  }

  @Post('merge')
  @Roles('SUPER_ADMIN')
  mergePersons(@Body() body: MergePersonsDto) {
    return this.personsService.merge(body.source_id, body.target_id);
  }

  @Post('auto-link')
  @Roles('SUPER_ADMIN')
  autoLink() {
    return this.personsService.autoLink();
  }
}
