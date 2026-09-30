import { BulkOverrideService } from './bulk-override.service';

describe('BulkOverrideService post-commit order', () => {
  function make() {
    const order: string[] = [];
    const tx = { $executeRaw: jest.fn(async () => { order.push('update'); return 2; }), audit_logs: { create: jest.fn() } };
    const prisma = {
      results: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r1', const_id: 'C1', candidates: { party_id: 'P1' } },
          { id: 'r2', const_id: 'C1', candidates: { party_id: 'P2' } },
        ]),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => { const out = await fn(tx); order.push('commit'); return out; }),
    };
    const results = { purgeElectionCache: jest.fn(async () => { order.push('purge'); return true; }) };
    const live = { publish: jest.fn(async () => { order.push('publish'); }) };
    const metrics = { resultOverrides: { add: jest.fn() } };
    const liveState = { invalidate: jest.fn(() => { order.push('invalidate'); }) };
    const svc = new BulkOverrideService(prisma as any, results as any, live as any, metrics as any, {} as any, liveState as any);
    return { svc, order, liveState, live };
  }

  const payload = {
    election_id: 'e1',
    overrides: [
      { result_id: 'r1', votes: 10, status: 'LEADING', margin: 4 },
      { result_id: 'r2', votes: 6, status: 'TRAILING', margin: 0 },
    ],
  } as any;

  it('commit → invalidate live-version memo → purge caches → publish SSE', async () => {
    const { svc, order, liveState } = make();
    await expect(svc.bulkOverride(payload, 'u1')).resolves.toEqual({ updated: 2 });
    expect(order).toEqual(['update', 'commit', 'invalidate', 'purge', 'publish']);
    expect(liveState.invalidate).toHaveBeenCalledWith('e1');
  });

  it('a failed publish does not fail the committed batch', async () => {
    const { svc, live } = make();
    live.publish.mockRejectedValue(new Error('redis down'));
    await expect(svc.bulkOverride(payload, 'u1')).resolves.toEqual({ updated: 2 });
  });
});
