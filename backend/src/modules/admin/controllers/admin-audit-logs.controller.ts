import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminAuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('audit-logs')
  @Roles('SUPER_ADMIN')
  getAuditLogs(
    @Query('user_id') user_id?: string,
    @Query('action') action?: string,
    @Query('entity_type') entity_type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditLogService.getLogs({ user_id, action, entity_type, from, to });
  }
}
