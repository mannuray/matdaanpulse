import { Logger } from '@nestjs/common';
import { AdminIngestController } from './admin-ingest.controller';
import { AuditLogService } from '../audit-log/audit-log.service';

/** A change that committed must not answer 500 because its audit row failed (a retry would create a second key). */
describe('AdminIngestController audit', () => {
  function make() {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const prisma: any = { election_ingest: { upsert: jest.fn(async () => ({})) }, audit_logs: { create: jest.fn().mockRejectedValue(new Error('audit down')) } };
    const status: any = { status: jest.fn(async () => ({ ok: true })) };
    const keys: any = { create: jest.fn(async () => ({ row: { id: 'k1' }, key: 'mpk_x' })), revoke: jest.fn(async () => undefined), list: jest.fn() };
    const ctrl = new AdminIngestController(prisma, status, {} as any, {} as any, {} as any, keys, new AuditLogService(prisma));
    return { ctrl, prisma, keys };
  }
  const req = { user: { id: 'u1' } };
  it('feed update, key create and key revoke succeed even when the audit insert fails, and each writes one audit row', async () => {
    const { ctrl, prisma } = make();
    await expect(ctrl.put('e', { active_source: 'eci-web', hold_minutes: 10 } as any, req)).resolves.toEqual({ ok: true });
    await expect(ctrl.createKey({ name: 'cloud' } as any, req)).resolves.toMatchObject({ key: 'mpk_x' });
    await expect(ctrl.revokeKey('k1', req)).resolves.toEqual({ revoked: true });
    expect(prisma.audit_logs.create.mock.calls.map((c: any) => c[0].data.action)).toEqual(['INGEST_FEED_UPDATE', 'INGEST_KEY_CREATE', 'INGEST_KEY_REVOKE']);
  });
});
