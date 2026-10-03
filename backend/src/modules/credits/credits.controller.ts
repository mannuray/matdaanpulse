import { Controller, Get } from '@nestjs/common';
import { CACHE_CONTROL, CacheControl } from '../../common/http/cache-control';
import { CreditsService } from './credits.service';

@Controller('credits')
@CacheControl(CACHE_CONTROL.PUBLIC)
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get()
  list() { return this.credits.list(); }
}
