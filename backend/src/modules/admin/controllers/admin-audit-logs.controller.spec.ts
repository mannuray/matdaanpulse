import { AdminAuditLogsController } from './admin-audit-logs.controller';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { Paginated } from '../../../common/paginated';
import { successEnvelope } from '../../../common/interceptors/transform.interceptor';

function setup(total = 450) {
  const rows = Array.from({ length: 3 }, (_, i) => ({ id: `a${i}` }));
  const prisma = {
    audit_logs: { findMany: jest.fn().mockResolvedValue(rows), count: jest.fn().mockResolvedValue(total) },
  };
  return { prisma, rows, ctrl: new AdminAuditLogsController(new AuditLogService(prisma as any)) };
}

describe('GET /admin/audit-logs', () => {
  it('no page/limit: the latest 200 as a bare array (what older admin builds read)', async () => {
    const { prisma, rows, ctrl } = setup();
    const out = await ctrl.getAuditLogs({});
    expect(out).toEqual(rows);
    expect(out).not.toBeInstanceOf(Paginated);
    expect(prisma.audit_logs.findMany.mock.calls[0][0]).toMatchObject({ take: 200, orderBy: [{ timestamp: 'desc' }, { id: 'desc' }] });
    expect(prisma.audit_logs.findMany.mock.calls[0][0]).not.toHaveProperty('skip');
  });

  it('page/limit: one page with the total, so older rows are reachable (no silent 200 cap)', async () => {
    const { prisma, rows, ctrl } = setup(450);
    const out = await ctrl.getAuditLogs({ page: 3, limit: 100, action: 'RESULT_OVERRIDE' });
    expect(out).toBeInstanceOf(Paginated);
    expect(successEnvelope(out)).toEqual({ success: true, data: rows, pagination: { page: 3, limit: 100, total: 450, totalPages: 5 } });
    expect(prisma.audit_logs.findMany.mock.calls[0][0]).toMatchObject({ skip: 200, take: 100, where: { action: 'RESULT_OVERRIDE' } });
    expect(prisma.audit_logs.count).toHaveBeenCalledWith({ where: { action: 'RESULT_OVERRIDE' } });
  });

  it('page alone defaults the page size to 200; limit alone starts at page 1', async () => {
    const a = setup();
    await a.ctrl.getAuditLogs({ page: 2 });
    expect(a.prisma.audit_logs.findMany.mock.calls[0][0]).toMatchObject({ skip: 200, take: 200 });
    const b = setup();
    await b.ctrl.getAuditLogs({ limit: 50 });
    expect(b.prisma.audit_logs.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 50 });
  });
});
