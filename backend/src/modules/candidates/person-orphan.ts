import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { toJsonSafe } from '../../common/util/json-safe';

type Tx = Prisma.TransactionClient;
type PersonRow = { id: string } & Record<string, unknown>;

/**
 * The orphan trigger (migration 018) deletes a person as soon as its last candidate moves away. After an
 * admin move, call this with the old person's row (read before the move, in the same transaction): when the
 * person is gone it writes PERSON_DELETE with that row as old_value. Returns whether the person was deleted.
 */
export async function auditIfPersonDeleted(
  tx: Tx, audit: AuditLogService, before: PersonRow | null, userId?: string | null,
): Promise<boolean> {
  if (!before) return false;
  const still = await tx.persons.findUnique({ where: { id: before.id }, select: { id: true } });
  if (still) return false;
  await audit.record(
    {
      userId, action: 'PERSON_DELETE', entityType: 'person', entityId: before.id,
      oldValue: toJsonSafe(before) as object, newValue: { reason: 'no contests left' },
    },
    tx,
  );
  return true;
}
