import { Injectable, Logger } from '@nestjs/common';
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

/**
 * Admin record edits (Decision 6 of the admin record pages plan). CANDIDATE_LINK_PERSON is "change person";
 * CANDIDATE_UNLINK_PERSON is no longer written (every candidate has a person, migration 018) but stays so
 * `lastEdit` still finds the historical rows. PERSON_DELETE is written when an admin action leaves a person
 * without candidates and the database deletes it.
 */
export const RECORD_AUDIT_ACTIONS = [
  'PARTY_CREATE', 'PARTY_UPDATE', 'PERSON_UPDATE', 'PERSON_MERGE', 'PERSON_MERGE_UNDO', 'PERSON_DELETE',
  'CANDIDATE_CREATE', 'CANDIDATE_UPDATE', 'CANDIDATE_LINK_PERSON', 'CANDIDATE_UNLINK_PERSON', 'CANDIDATE_SPLIT',
  'CONSTITUENCY_UPDATE',
] as const;
export type RecordAuditAction = (typeof RECORD_AUDIT_ACTIONS)[number];
export type RecordEntityType = 'party' | 'person' | 'candidate' | 'constituency';

/** A record-edit audit entry; `userId` may be missing (row is kept, user_id NULL). */
export type RecordAuditEntry = Omit<AuditEntry, 'userId' | 'action' | 'entityType'> & {
  userId?: string | null;
  action: RecordAuditAction;
  entityType: RecordEntityType;
};

/** An operational audit entry (election status, ingest feed and keys, seat corrections): any action, any entity. */
export interface OperationalAuditEntry { userId?: string | null; action: string; entityType: string; entityId: string; oldValue?: object; newValue?: object }

/** Interactive-transaction client as used by `record` (needs raw SQL for the savepoint). */
export type AuditTx = Pick<Prisma.TransactionClient, 'audit_logs' | '$executeRawUnsafe'>;

export interface LastEdit {
  at: string;
  by: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  private toRow(e: RecordAuditEntry | AuditEntry | OperationalAuditEntry) {
    return {
      user_id: e.userId ?? null,
      action: e.action,
      entity_type: e.entityType,
      entity_id: e.entityId,
      old_value: e.oldValue as Prisma.InputJsonValue,
      new_value: e.newValue as Prisma.InputJsonValue,
    };
  }

  /**
   * Write one audit row for a record edit. Never throws: a failed audit write must not fail the
   * user's save, so it is logged as a warning. Inside a transaction (`tx`) the insert runs under a
   * savepoint — a failed INSERT would otherwise abort the whole transaction and lose the save.
   */
  async record(entry: RecordAuditEntry, tx?: AuditTx): Promise<void> {
    return this.write(entry, tx);
  }

  /** An operational audit row (any action): the same never-throws, savepoint-in-a-transaction contract as `record`. */
  async log(entry: OperationalAuditEntry, tx?: AuditTx): Promise<void> {
    return this.write(entry, tx);
  }

  private async write(entry: RecordAuditEntry | OperationalAuditEntry, tx?: AuditTx): Promise<void> {
    try {
      if (!tx) {
        await this.prisma.audit_logs.create({ data: this.toRow(entry) });
        return;
      }
      await tx.$executeRawUnsafe('SAVEPOINT audit_row');
      try {
        await tx.audit_logs.create({ data: this.toRow(entry) });
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT audit_row');
      } catch (err) {
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT audit_row');
        throw err;
      }
    } catch (err) {
      this.logger.warn(`Audit write failed (${entry.action} ${entry.entityType}/${entry.entityId}): ${(err as Error).message}`);
    }
  }

  /** Many audit rows in one insert (bulk edits). Never throws, like `record`. */
  async recordMany(entries: RecordAuditEntry[]): Promise<void> {
    if (!entries.length) return;
    try {
      await this.prisma.audit_logs.createMany({ data: entries.map((e) => this.toRow(e)) });
    } catch (err) {
      this.logger.warn(`Audit write failed (${entries.length} × ${entries[0].action}): ${(err as Error).message}`);
    }
  }

  /**
   * Newest record-edit audit row of an entity as { at, by: user name }, or null when it was never edited.
   * Only the RECORD_AUDIT_ACTIONS count: other rows on the same entity (e.g. SEAT_LOCK_TAKEOVER on a
   * constituency) are not edits.
   */
  async lastEdit(entityType: RecordEntityType, entityId: string): Promise<LastEdit | null> {
    const row = await this.prisma.audit_logs.findFirst({
      where: { entity_type: entityType, entity_id: entityId, action: { in: [...RECORD_AUDIT_ACTIONS] } },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true, users: { select: { name: true } } },
    });
    return row ? { at: row.timestamp.toISOString(), by: row.users?.name ?? null } : null;
  }

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
