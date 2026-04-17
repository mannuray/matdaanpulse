import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { StatesService } from './states.service';

@Controller('states')
export class StatesController {
  constructor(private readonly statesService: StatesService) {}

  @Get()
  findAll() {
    return this.statesService.findAll();
  }

  @Get(':id/districts')
  findDistricts(@Param('id', ParseIntPipe) id: number) {
    return this.statesService.findDistricts(id);
  }

  @Get(':id/regions')
  findRegions(@Param('id', ParseIntPipe) id: number) {
    return this.statesService.findRegions(id);
  }
}
