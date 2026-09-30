import { ResultOverrideService } from './result-override.service';
import { ResultChangeNotifier } from './result-change-notifier';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('ResultOverrideService audit write', () => {
  function make() {
    const txAuditCreate = jest.fn().mockResolvedValue({});
    const globalAuditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      results: { update: jest.fn().mockResolvedValue({ id: 'r1', election_id: 'e1', const_id: 'c1', status: 'LEADING', margin: 5, votes: 10, round_no: 1 }) },
      constituencies: { update: jest.fn() },
      audit_logs: { create: txAuditCreate },
    };
    const prisma = {
      results: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', const_id: 'c1', election_id: 'e1', votes: 1, status: 'TRAILING', margin: 0, candidates: { party_id: 'P' } }) },
      audit_logs: { create: globalAuditCreate },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const audit = new AuditLogService(prisma as any);
    const live = { publish: jest.fn().mockResolvedValue(undefined) };
    const results = { purgeElectionCache: jest.fn().mockResolvedValue(true) };
    const metrics = { resultOverrides: { add: jest.fn() }, ssePublishSkipped: { add: jest.fn() } };
    const order: string[] = [];
    live.publish.mockImplementation(async () => { order.push('publish'); });
    results.purgeElectionCache.mockImplementation(async () => { order.push('purge'); return true; });
    const liveState = { invalidate: jest.fn(() => { order.push('invalidate'); }) };
    const notifier = new ResultChangeNotifier(results as any, live as any, metrics as any, liveState as any);
    const svc = new ResultOverrideService(prisma as any, audit, notifier);
    return { svc, txAuditCreate, globalAuditCreate, order, liveState };
  }

  it('writes the audit row with the transaction client, not the global one', async () => {
    const { svc, txAuditCreate, globalAuditCreate } = make();
    await svc.override({ result_id: 'r1', votes: 10, status: 'LEADING', margin: 5 } as any, 'user-1');
    expect(txAuditCreate).toHaveBeenCalledTimes(1);
    expect(txAuditCreate.mock.calls[0][0].data).toMatchObject({ user_id: 'user-1', action: 'RESULT_OVERRIDE', entity_type: 'result', entity_id: 'r1' });
    expect(globalAuditCreate).not.toHaveBeenCalled();
  });

  it('still succeeds when the live publish fails after commit', async () => {
    const { svc } = make();
    (svc as any).notifier.live.publish.mockRejectedValue(new Error('redis down'));
    await expect(svc.override({ result_id: 'r1', votes: 10, status: 'LEADING', margin: 5 } as any, 'user-1')).resolves.toMatchObject({ id: 'r1' });
  });

  it('after commit: forgets the live-version memo, purges caches, then publishes (review M5)', async () => {
    const { svc, order, liveState } = make();
    await svc.override({ result_id: 'r1', votes: 10, status: 'LEADING', margin: 5 } as any, 'user-1');
    expect(order).toEqual(['invalidate', 'purge', 'publish']);
    expect(liveState.invalidate).toHaveBeenCalledWith('e1');
  });
});
