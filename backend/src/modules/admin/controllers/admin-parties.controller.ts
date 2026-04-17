import { Controller, Post, Put, Get, Body, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { PartiesService } from '../../parties/parties.service';
import { AiEnrichmentService } from '../../ai/ai-enrichment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminPartyDto } from '../dto/admin-response.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPartiesController {
  constructor(
    private readonly partiesService: PartiesService,
    private readonly aiEnrichmentService: AiEnrichmentService,
  ) {}

  @Post('parties')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPartyDto))
  createParty(@Body() body: { id: string; name: string; color?: string; symbol_url?: string; abbreviation?: string; leader_name?: string; founded_year?: number; headquarters?: string; website?: string }) {
    return this.partiesService.create(body);
  }

  @Get('parties/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPartyDto))
  findOne(@Param('id') id: string) {
    return this.partiesService.findOne(id);
  }

  @Put('parties/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPartyDto))
  updateParty(@Param('id') id: string, @Body() body: any) {
    return this.partiesService.update(id, body);
  }

  @Post('parties/:id/enrich')
  @Roles('SUPER_ADMIN', 'EDITOR')
  enrichParty(@Param('id') id: string) {
    return this.aiEnrichmentService.enrichParty(id);
  }
}
