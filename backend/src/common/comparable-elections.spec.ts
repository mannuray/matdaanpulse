import { comparableElectionIds } from './comparable-elections';

describe('comparableElectionIds', () => {
  const prisma = (rows: { id: string }[]) => ({ elections: { findMany: jest.fn().mockResolvedValue(rows) } }) as any;
  const as26 = { id: 'as26', type: 'VS', state_id: 4, delimitation: '2023' };

  it('asks for the same type, state and delimitation, and keeps the given order', async () => {
    const p = prisma([{ id: 'b' }, { id: 'a' }]);
    expect(await comparableElectionIds(p, as26, ['a', 'x', 'b'])).toEqual(['a', 'b']);
    expect(p.elections.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['a', 'x', 'b'] }, type: 'VS', state_id: 4, delimitation: '2023' });
  });

  it('a redrawn state has no comparable past (2008-era Assam is filtered out by the query)', async () => {
    expect(await comparableElectionIds(prisma([]), as26, ['as21', 'as16'])).toEqual([]);
  });

  it('no delimitation compares with nothing, without a query; the election itself is never its own history', async () => {
    const p = prisma([{ id: 'as26' }]);
    expect(await comparableElectionIds(p, { ...as26, delimitation: null }, ['as21'])).toEqual([]);
    expect(p.elections.findMany).not.toHaveBeenCalled();
    expect(await comparableElectionIds(p, as26, ['as26'])).toEqual([]);
  });
});
