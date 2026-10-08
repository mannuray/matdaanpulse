import { ElectionCacheService, electionKeys } from './election-cache.service';

function make() {
  const cache: any = { del: jest.fn(async () => true), delByPattern: jest.fn(async () => true) };
  return { svc: new ElectionCacheService(cache), cache };
}

describe('electionKeys: every election cache key, built in one place', () => {
  it('names each view of an election', () => {
    expect(electionKeys.versioned('e', 'summary', 7)).toBe('election:e:summary:v7');
    expect(electionKeys.snapshot('e', 7)).toBe('election:e:snapshot:v7');
    expect(electionKeys.publicAnalysis('e')).toBe('election:e:public-analysis');
    expect(electionKeys.analysisSummary('e')).toBe('election:e:analysis-summary');
    expect(electionKeys.baseline('e')).toBe('election:e:baseline');
    expect(electionKeys.events('e')).toBe('election:e:events');
  });
});

describe('ElectionCacheService', () => {
  it('purgeResults: only the unversioned public analysis; no SCAN (results views are keyed by version, never served stale)', async () => {
    const { svc, cache } = make();
    await expect(svc.purgeResults('e')).resolves.toBe(true);
    expect(cache.delByPattern).not.toHaveBeenCalled();
    expect(cache.del.mock.calls.map((c: any) => c[0])).toEqual(['election:e:public-analysis']);
  });
  it('purgeElection: everything (a status change), including the analysis summary and the baseline', async () => {
    const { svc, cache } = make();
    await svc.purgeElection('e');
    expect(cache.del.mock.calls.map((c: any) => c[0]).sort()).toEqual(['election:e:analysis-summary', 'election:e:baseline', 'election:e:public-analysis']);
  });
  it('reports a failed delete', async () => {
    const { svc, cache } = make();
    cache.del.mockResolvedValueOnce(false);
    await expect(svc.purgeResults('e')).resolves.toBe(false);
  });
});
