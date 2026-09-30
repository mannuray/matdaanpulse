import { ResultChangeNotifier, type ChangedRow } from './result-change-notifier';

describe('ResultChangeNotifier.afterCommit', () => {
  const row: ChangedRow = { const_id: 'C1', p: 'P1', m: 4, s: 'LEADING', r: 1 };

  function make() {
    const order: string[] = [];
    const results = { purgeElectionCache: jest.fn(async () => { order.push('purge'); return true; }) };
    const live = { publish: jest.fn(async () => { order.push('publish'); }) };
    const metrics = {
      resultOverrides: { add: jest.fn(() => { order.push('metrics'); }) },
      ssePublishSkipped: { add: jest.fn() },
    };
    const liveState = { invalidate: jest.fn(() => { order.push('invalidate'); }) };
    const notifier = new ResultChangeNotifier(results as any, live as any, metrics as any, liveState as any);
    return { notifier, order, results, live, metrics, liveState };
  }

  it('runs metrics, invalidate, purge, publish in that order', async () => {
    const { notifier, order, live, liveState } = make();
    await notifier.afterCommit('e1', [row], { kind: 'batch', overrideCount: 1, status: 'bulk' });
    expect(order).toEqual(['metrics', 'invalidate', 'purge', 'publish']);
    expect(liveState.invalidate).toHaveBeenCalledWith('e1');
    expect(live.publish).toHaveBeenCalledWith('e1', { type: 'batch-update', data: [row] });
  });

  it('single kind publishes a result-update with the row as data', async () => {
    const { notifier, live } = make();
    await notifier.afterCommit('e1', [row], { kind: 'single', overrideCount: 1, status: 'LEADING' });
    expect(live.publish).toHaveBeenCalledWith('e1', { type: 'result-update', data: row });
  });

  it('never throws and keeps going when metrics, purge or publish fail', async () => {
    const { notifier, order, results, live, metrics } = make();
    metrics.resultOverrides.add.mockImplementation(() => { throw new Error('otel'); });
    results.purgeElectionCache.mockRejectedValue(new Error('redis'));
    live.publish.mockRejectedValue(new Error('redis'));
    await expect(notifier.afterCommit('e1', [row], { kind: 'batch', overrideCount: 1, status: 'bulk' })).resolves.toBeUndefined();
    expect(live.publish).toHaveBeenCalled();
    expect(order).toEqual(['invalidate']);
  });

  it('a failed purge does not stop the publish', async () => {
    const { notifier, results, live } = make();
    results.purgeElectionCache.mockRejectedValue(new Error('redis'));
    await notifier.afterCommit('e1', [row], { kind: 'batch', overrideCount: 1, status: 'bulk' });
    expect(live.publish).toHaveBeenCalledTimes(1);
  });

  it('skips the publish when there are no rows, or counts a missing-party skip', async () => {
    const { notifier, live, metrics } = make();
    await notifier.afterCommit('e1', [], { kind: 'batch', overrideCount: 0, status: 'bulk' });
    await notifier.afterCommit('e1', [], { kind: 'single', overrideCount: 1, status: 'LEADING', skippedMissingParty: { resultId: 'r1' } });
    expect(live.publish).not.toHaveBeenCalled();
    expect(metrics.ssePublishSkipped.add).toHaveBeenCalledWith(1, { reason: 'missing_party', election_id: 'e1' });
  });
});
