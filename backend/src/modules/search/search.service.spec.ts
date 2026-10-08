import { SearchService, escapeLike, FUZZY_MIN_QUERY } from './search.service';

describe('SearchService (unit)', () => {
  it('escapeLike makes %, _ and \\ literal', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });

  function make() {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const prisma: any = { $queryRaw: queryRaw, constituencies: { findMany: jest.fn() }, candidates: { findMany: jest.fn() } };
    return { svc: new SearchService(prisma), queryRaw, prisma };
  }
  const whereOf = (call: any[]) => (call[0].sql as string).split('ORDER BY')[0];

  it(`queries shorter than ${FUZZY_MIN_QUERY} letters match by substring only (no trigram noise)`, async () => {
    const { svc, queryRaw } = make();
    await svc.searchConstituencies('ara', 'e');
    expect(whereOf(queryRaw.mock.calls[0])).not.toMatch(/word_similarity/);
    await svc.searchConstituencies('arrah', 'e');
    expect(whereOf(queryRaw.mock.calls[1])).toMatch(/word_similarity/);
  });

  it('no hits → no second query; a blank query lists by name as before', async () => {
    const { svc, prisma } = make();
    expect(await svc.searchCandidates('zzzz', 'e')).toEqual([]);
    expect(prisma.candidates.findMany).not.toHaveBeenCalled();
    prisma.candidates.findMany.mockResolvedValue([]);
    await svc.searchCandidates('  ', 'e');
    expect(prisma.candidates.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: 'asc' }, take: 50 }));
  });
});
