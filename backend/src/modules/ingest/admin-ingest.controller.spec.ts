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
    await expect(ctrl.createKey({ name: 'cloud', election_id: 'e1', expires_at: '2027-03-01T00:00:00Z' } as any, req)).resolves.toMatchObject({ key: 'mpk_x' });
    await expect(ctrl.revokeKey('k1', req)).resolves.toEqual({ revoked: true });
    expect(prisma.audit_logs.create.mock.calls.map((c: any) => c[0].data.action)).toEqual(['INGEST_FEED_UPDATE', 'INGEST_KEY_CREATE', 'INGEST_KEY_REVOKE']);
  });
  it('key create passes the election and expiry through and audits them', async () => {
    const { ctrl, prisma, keys } = make();
    await ctrl.createKey({ name: 'cloud', election_id: 'e1', expires_at: '2027-03-01T00:00:00Z' } as any, req);
    expect(keys.create).toHaveBeenCalledWith('cloud', 'u1', { electionId: 'e1', expiresAt: new Date('2027-03-01T00:00:00Z') });
    await ctrl.createKey({ name: 'cloud2', election_id: 'e1' } as any, req);
    expect(keys.create).toHaveBeenLastCalledWith('cloud2', 'u1', { electionId: 'e1', expiresAt: undefined });
    expect(prisma.audit_logs.create.mock.calls[0][0].data.new_value).toMatchObject({ name: 'cloud', election_id: 'e1' });
  });
  it('shard put / delete and hold release each write an audit row', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const prisma: any = { audit_logs: { create: jest.fn(async () => ({})) } };
    const shards: any = { upsert: jest.fn(async () => ({ name: 'north' })), remove: jest.fn(async () => undefined) };
    const holds: any = { release: jest.fn(async () => undefined) };
    const ctrl = new AdminIngestController(prisma, {} as any, shards, holds, {} as any, {} as any, new AuditLogService(prisma));
    await ctrl.putShard('e', 'north', { selector: { state_ids: [1] }, source_override: null } as any, req);
    await ctrl.delShard('e', 'north', req);
    await expect(ctrl.release('e', 'S1', req)).resolves.toEqual({ released: true });
    const rows = prisma.audit_logs.create.mock.calls.map((c: any) => c[0].data);
    expect(rows.map((r: any) => [r.action, r.user_id, r.entity_type, r.entity_id])).toEqual([
      ['INGEST_SHARD_UPDATE', 'u1', 'election', 'e'], ['INGEST_SHARD_DELETE', 'u1', 'election', 'e'], ['INGEST_HOLD_RELEASE', 'u1', 'constituency', 'S1']]);
    expect(rows[0].new_value).toEqual({ shard: 'north', selector: { state_ids: [1] }, source_override: null });
    expect(rows[1].old_value).toEqual({ shard: 'north' });
    expect(rows[2].new_value).toEqual({ election_id: 'e' });
  });
});
