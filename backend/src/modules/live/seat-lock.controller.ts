import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SeatLockService } from './seat-lock.service';
import { SeatLockAcquire, SeatLockQuery, SeatLockRelease } from './dto/seat-lock.dto';

type AuthedReq = { user: { id: string; name: string } };

@Controller('admin/live/locks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'EDITOR')
export class SeatLockController {
  constructor(private readonly locks: SeatLockService) {}

  @Get()
  list(@Query() q: SeatLockQuery) {
    return this.locks.list(q.election_id);
  }

  @Post()
  @HttpCode(200)
  acquire(@Req() req: AuthedReq, @Body() body: SeatLockAcquire) {
    return this.locks.acquire(body.election_id, body.const_id, req.user, !!body.take_over);
  }

  @Post('release')
  @HttpCode(204)
  release(@Req() req: AuthedReq, @Body() body: SeatLockRelease) {
    return this.locks.release(body.election_id, body.const_id, req.user.id);
  }
}
