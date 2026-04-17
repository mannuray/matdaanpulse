import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async getLogs(filters: { user_id?: string; action?: string; entity_type?: string; from?: string; to?: string }) {
    const where: Prisma.audit_logsWhereInput = {};
    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.action) where.action = filters.action;
    if (filters.entity_type) where.entity_type = filters.entity_type;
    if (filters.from || filters.to) {
      where.timestamp = {};
      if (filters.from) where.timestamp.gte = new Date(filters.from);
      if (filters.to) where.timestamp.lte = new Date(filters.to);
    }

    return this.prisma.audit_logs.findMany({
      where,
      include: {
        users: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }

  async create(userId: string, action: string, entityType: string, entityId: string, oldValue?: object, newValue?: object) {
    return this.prisma.audit_logs.create({
      data: {
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_value: oldValue as Prisma.InputJsonValue,
        new_value: newValue as Prisma.InputJsonValue,
      },
    });
  }
}
