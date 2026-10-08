import { IdParamPipe } from '../../../common/validation/id-param.pipe';
import { PARTY_ID_MAX, PARTY_ID_RE } from '../../../common/validation/ids';
import { Controller, Post, Put, Get, Body, Param, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { PartiesService } from '../../parties/parties.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminPartyDto, AdminPartyUsageDto } from '../dto/admin-response.dto';
import { CreatePartyDto, UpdatePartyDto } from '../../parties/dto/party-input.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPartiesController {
  constructor(
    private readonly partiesService: PartiesService,
    private readonly audit: AuditLogService,
  ) {}

  @Post('parties')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPartyDto))
  async createParty(@Req() req: any, @Body() body: CreatePartyDto) {
    const party = await this.partiesService.create(body, req.user?.id);
    return { ...party, last_edit: await this.audit.lastEdit('party', party.id) };
  }

  @Get('parties/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPartyDto))
  async findOne(@Param('id', new IdParamPipe(PARTY_ID_RE, PARTY_ID_MAX, 'party id')) id: string) {
    const [party, last_edit] = await Promise.all([this.partiesService.findOne(id), this.audit.lastEdit('party', id)]);
    return { ...party, last_edit };
  }

  /** Candidates and wins per election, for the party page's usage card. */
  @Get('parties/:id/usage')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPartyUsageDto))
  usage(@Param('id', new IdParamPipe(PARTY_ID_RE, PARTY_ID_MAX, 'party id')) id: string) {
    return this.partiesService.usage(id);
  }

  @Put('parties/:id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPartyDto))
  async updateParty(@Req() req: any, @Param('id', new IdParamPipe(PARTY_ID_RE, PARTY_ID_MAX, 'party id')) id: string, @Body() body: UpdatePartyDto) {
    const party = await this.partiesService.update(id, body, req.user?.id);
    return { ...party, last_edit: await this.audit.lastEdit('party', id) };
  }
}
