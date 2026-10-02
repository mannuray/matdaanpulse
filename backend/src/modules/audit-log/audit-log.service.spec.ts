import { Logger } from '@nestjs/common';
import { AuditLogService, RECORD_AUDIT_ACTIONS } from './audit-log.service';
import { changedFields, createdFields } from './audit-diff';

const entry = { userId: 'u1', action: 'PARTY_UPDATE' as const, entityType: 'party' as const, entityId: 'BJP', oldValue: { name: 'A' }, newValue: { name: 'B' } };

describe('AuditLogService.record', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => { warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined); });
  afterEach(() => warn.mockRestore());

  it('writes one row with the entry fields', async () => {
    const prisma = { audit_logs: { create: jest.fn().mockResolvedValue({}) } };
    await new AuditLogService(prisma as any).record(entry);
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create).toHaveBeenCalledWith({
      data: {
        user_id: 'u1', action: 'PARTY_UPDATE', entity_type: 'party', entity_id: 'BJP',
        old_value: { name: 'A' }, new_value: { name: 'B' },
      },
    });
  });

  it('never throws when the insert fails: logs a warning instead', async () => {
    const prisma = { audit_logs: { create: jest.fn().mockRejectedValue(new Error('db down')) } };
    await expect(new AuditLogService(prisma as any).record(entry)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('PARTY_UPDATE'));
  });

  it('inside a transaction, guards the insert with a savepoint so a failure leaves the transaction usable', async () => {
    const calls: string[] = [];
    const tx = {
      $executeRawUnsafe: jest.fn(async (sql: string) => { calls.push(sql); return 0; }),
      audit_logs: { create: jest.fn(async () => { calls.push('insert'); throw new Error('bad row'); }) },
    };
    const prisma = { audit_logs: { create: jest.fn() } };
    await expect(new AuditLogService(prisma as any).record(entry, tx as any)).resolves.toBeUndefined();
    expect(calls).toEqual(['SAVEPOINT audit_row', 'insert', 'ROLLBACK TO SAVEPOINT audit_row']);
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('inside a transaction, releases the savepoint after a successful insert', async () => {
    const calls: string[] = [];
    const tx = {
      $executeRawUnsafe: jest.fn(async (sql: string) => { calls.push(sql); return 0; }),
      audit_logs: { create: jest.fn(async () => { calls.push('insert'); return {}; }) },
    };
    await new AuditLogService({} as any).record(entry, tx as any);
    expect(calls).toEqual(['SAVEPOINT audit_row', 'insert', 'RELEASE SAVEPOINT audit_row']);
  });

  it('recordMany writes all rows in one createMany and skips an empty list', async () => {
    const prisma = { audit_logs: { createMany: jest.fn().mockResolvedValue({ count: 2 }) } };
    const svc = new AuditLogService(prisma as any);
    await svc.recordMany([]);
    expect(prisma.audit_logs.createMany).not.toHaveBeenCalled();
    await svc.recordMany([entry, { ...entry, entityId: 'INC' }]);
    expect(prisma.audit_logs.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it('recordMany never throws', async () => {
    const prisma = { audit_logs: { createMany: jest.fn().mockRejectedValue(new Error('x')) } };
    await expect(new AuditLogService(prisma as any).recordMany([entry])).resolves.toBeUndefined();
  });
});

describe('AuditLogService.lastEdit', () => {
  it('is null when the entity has no audit rows', async () => {
    const prisma = { audit_logs: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new AuditLogService(prisma as any).lastEdit('party', 'BJP')).resolves.toBeNull();
    expect(prisma.audit_logs.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { entity_type: 'party', entity_id: 'BJP', action: { in: [...RECORD_AUDIT_ACTIONS] } },
      orderBy: { timestamp: 'desc' },
    }));
  });

  it('counts only the 9 record-edit actions (a SEAT_LOCK_TAKEOVER on the seat is not an edit)', async () => {
    const prisma = { audit_logs: { findFirst: jest.fn().mockResolvedValue(null) } };
    await new AuditLogService(prisma as any).lastEdit('constituency', 'BR_VS_1');
    const actions: string[] = prisma.audit_logs.findFirst.mock.calls[0][0].where.action.in;
    expect(actions).toHaveLength(9);
    expect(actions).toContain('CONSTITUENCY_UPDATE');
    expect(actions).not.toContain('SEAT_LOCK_TAKEOVER');
  });

  it('returns the newest row as { at: ISO, by: user name }', async () => {
    const prisma = { audit_logs: { findFirst: jest.fn().mockResolvedValue({
      timestamp: new Date('2026-10-01T10:00:00Z'), users: { name: 'Mannu K' },
    }) } };
    await expect(new AuditLogService(prisma as any).lastEdit('party', 'BJP'))
      .resolves.toEqual({ at: '2026-10-01T10:00:00.000Z', by: 'Mannu K' });
  });

  it('by is null when the user was deleted', async () => {
    const prisma = { audit_logs: { findFirst: jest.fn().mockResolvedValue({ timestamp: new Date('2026-10-01T10:00:00Z'), users: null }) } };
    await expect(new AuditLogService(prisma as any).lastEdit('person', 'p1')).resolves.toEqual({ at: '2026-10-01T10:00:00.000Z', by: null });
  });
});

describe('changedFields', () => {
  it('keeps only the columns that differ, and ignores updated_at', () => {
    expect(changedFields(
      { id: 'BJP', name: 'A', color: '#f00', updated_at: new Date(1) },
      { id: 'BJP', name: 'B', color: '#f00', updated_at: new Date(2) },
    )).toEqual({ oldValue: { name: 'A' }, newValue: { name: 'B' } });
  });

  it('is null when nothing changed (dates and decimals compared by value)', () => {
    const d = { toJSON: () => '12.50' };
    expect(changedFields(
      { a: new Date('2020-01-01'), t: d, m: { x: 1 } },
      { a: new Date('2020-01-01'), t: { toJSON: () => '12.50' }, m: { x: 1 } },
    )).toBeNull();
  });

  it('diffs metadata by key', () => {
    expect(changedFields(
      { metadata: { bio: 'old', tags: ['a'], keep: 1 } },
      { metadata: { bio: 'new', tags: ['a'], keep: 1, added: true } },
    )).toEqual({
      oldValue: { metadata: { bio: 'old', added: null } },
      newValue: { metadata: { bio: 'new', added: true } },
    });
  });

  it('treats a null metadata like an empty one', () => {
    expect(changedFields({ metadata: null }, { metadata: { tags: ['x'] } }))
      .toEqual({ oldValue: { metadata: { tags: null } }, newValue: { metadata: { tags: ['x'] } } });
  });
});

describe('createdFields', () => {
  it('keeps the set (non-null) columns of a new row, without updated_at', () => {
    expect(createdFields({ id: 'X', name: 'X party', color: null, metadata: {}, updated_at: new Date() }))
      .toEqual({ id: 'X', name: 'X party' });
  });
});
