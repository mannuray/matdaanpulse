import { Controller, Delete, Get, Post, Put, Body, Param, Query, UseGuards, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { PersonsService } from '../../candidates/persons.service';
import { AiEnrichmentService } from '../../ai/ai-enrichment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminPersonDto } from '../dto/admin-response.dto';
import { CreatePersonDto, UpdatePersonDto, MergePersonsDto, EnrichPersonsDto } from '../dto/admin-input.dto';

@Controller('admin/persons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPersonsController {
  constructor(
    private readonly personsService: PersonsService,
    private readonly aiService: AiEnrichmentService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'EDITOR')
  findAllPersons(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('state_id') stateId?: string,
    @Query('region_id') regionId?: string,
  ) {
    return this.personsService.findAll(
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 2000) : 100,
      q || '',
      {
        state_id: stateId ? Number(stateId) : undefined,
        region_id: regionId ? Number(regionId) : undefined,
      },
    );
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

  @Post('enrich')
  @Roles('SUPER_ADMIN')
  enrichPersons(@Body() body?: EnrichPersonsDto) {
    return this.aiService.enrichPersons(body?.person_ids);
  }

  @Get('enrich/status')
  @Roles('SUPER_ADMIN', 'EDITOR')
  getEnrichmentStatus() {
    return this.aiService.getProgress('persons');
  }
}
