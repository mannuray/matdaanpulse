import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from '../../audit-log/audit-log.service';
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
  getAuditLogs(@Query() query: AuditLogsQueryDto) {
    return this.auditLogService.getLogs(query);
  }
}
