import { ResultsService } from './results.service';

describe('ResultsService.purgeElectionCache', () => {
  it('deletes the derived keys but never the content-addressed snapshot keys', async () => {
    const cache = {
      delByPattern: jest.fn(async () => true),
      del: jest.fn(async () => true),
    };
    const svc = new ResultsService({} as any, cache as any, {} as any);
    await expect(svc.purgeElectionCache('E1')).resolves.toBe(true);
    const patterns = cache.delByPattern.mock.calls.map((c: any[]) => c[0]);
    expect(patterns).toEqual(['election:E1:summary:*', 'election:E1:vote-share:*', 'election:E1:full-results:*']);
    expect(cache.del).toHaveBeenCalledWith('election:E1:public-analysis');
    // No pattern may match a snapshot key.
    const snapshot = 'election:E1:snapshot:v123';
    for (const p of patterns) expect(snapshot.startsWith(p.slice(0, -1))).toBe(false);
  });

  it('reports false when any deletion failed', async () => {
    const cache = { delByPattern: jest.fn(async () => false), del: jest.fn(async () => true) };
    const svc = new ResultsService({} as any, cache as any, {} as any);
    await expect(svc.purgeElectionCache('E1')).resolves.toBe(false);
  });
});
