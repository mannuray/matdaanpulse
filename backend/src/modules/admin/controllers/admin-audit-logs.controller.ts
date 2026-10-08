import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AUDIT_LOGS_DEFAULT_LIMIT, AuditLogService } from '../../audit-log/audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuditLogsQueryDto } from '../../../common/dto/query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminAuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('audit-logs')
  @Roles('SUPER_ADMIN')
  getAuditLogs(@Query() { page, limit, ...filters }: AuditLogsQueryDto) {
    // Paged when asked (the admin Audit logs page); otherwise the latest 200 as a bare array, as before.
    if (page || limit) return this.auditLogService.getLogsPage(filters, page ?? 1, limit ?? AUDIT_LOGS_DEFAULT_LIMIT);
    return this.auditLogService.getLogs(filters);
  }
}
