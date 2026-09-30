import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface AuditEntry {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: object;
  newValue?: object;
}

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

  /**
   * Pass the interactive-transaction client as `tx` when auditing inside a
   * transaction, so the audit row commits/rolls back with the change and does
   * not wait for a second pool connection (review E-H4).
   */
  async create(data: AuditEntry, tx: Pick<Prisma.TransactionClient, 'audit_logs'> = this.prisma) {
    return tx.audit_logs.create({
      data: {
        user_id: data.userId,
        action: data.action,
        entity_type: data.entityType,
        entity_id: data.entityId,
        old_value: data.oldValue as Prisma.InputJsonValue,
        new_value: data.newValue as Prisma.InputJsonValue,
      },
    });
  }
}
