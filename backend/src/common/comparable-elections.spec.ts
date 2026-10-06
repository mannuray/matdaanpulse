import { comparableElectionIds, earlierComparableElectionIds } from './comparable-elections';

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

describe('earlierComparableElectionIds (the history when none is given)', () => {
  const prisma = (rows: { id: string }[]) => ({ elections: { findMany: jest.fn().mockResolvedValue(rows) } }) as any;
  const jh24 = { id: 'jh24', type: 'VS', state_id: 14, delimitation: '2008', year: 2024 };

  it('every earlier election of the same type, state and delimitation, newest first', async () => {
    const p = prisma([{ id: 'jh19' }, { id: 'jh14' }]);
    expect(await earlierComparableElectionIds(p, jh24)).toEqual(['jh19', 'jh14']);
    expect(p.elections.findMany.mock.calls[0][0]).toEqual({
      where: { type: 'VS', state_id: 14, delimitation: '2008', year: { lt: 2024 } }, select: { id: true }, orderBy: { year: 'desc' },
    });
  });

  it('no delimitation: no history, without a query', async () => {
    const p = prisma([{ id: 'x' }]);
    expect(await earlierComparableElectionIds(p, { ...jh24, delimitation: null })).toEqual([]);
    expect(p.elections.findMany).not.toHaveBeenCalled();
  });
});
