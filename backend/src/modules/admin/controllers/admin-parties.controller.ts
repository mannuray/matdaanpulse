import { Controller, Post, Put, Get, Body, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { PartiesService } from '../../parties/parties.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminPartyDto } from '../dto/admin-response.dto';
import { CreatePartyDto, UpdatePartyDto } from '../../parties/dto/party-input.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Post('parties')
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(new MapToDtoInterceptor(AdminPartyDto))
  createParty(@Body() body: CreatePartyDto) {
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
  updateParty(@Param('id') id: string, @Body() body: UpdatePartyDto) {
    return this.partiesService.update(id, body);
  }
}
