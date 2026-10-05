import { ResultsService } from './results.service';
import { ElectionNotFoundException } from '../../common/exceptions';

describe('ResultsService.getRegionShares', () => {
  function make(rows: unknown[], exists = true) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows), elections: { findUnique: jest.fn().mockResolvedValue(exists ? { id: 'e1' } : null) } };
    const keys: string[] = [];
    const cache = { getOrSet: jest.fn(async (key: string, _ttl: number, loader: () => Promise<unknown>) => { keys.push(key); return loader(); }) };
    const liveState = { get: jest.fn().mockResolvedValue({ version: 7 }) };
    return { svc: new ResultsService(prisma as any, cache as any, liveState as any), keys };
  }

  it('groups each region\'s party votes and seats won, cached under the live version', async () => {
    const { svc, keys } = make([
      { region_id: 1, region_name: 'Upper Assam', seats: 2n, const_ids: ['AS_1', 'AS_2'], party_id: 'BJP', votes: 100n, won: 2n },
      { region_id: 1, region_name: 'Upper Assam', seats: 2n, const_ids: ['AS_1', 'AS_2'], party_id: 'INC', votes: 50n, won: 0n },
      { region_id: 2, region_name: 'Hills', seats: 1n, const_ids: ['AS_3'], party_id: 'BJP', votes: 30n, won: 1n },
    ]);
    expect(await svc.getRegionShares('e1')).toEqual({ regions: [
      { id: 1, name: 'Upper Assam', seats: 2, const_ids: ['AS_1', 'AS_2'], parties: [{ party_id: 'BJP', votes: 100, won: 2 }, { party_id: 'INC', votes: 50, won: 0 }] },
      { id: 2, name: 'Hills', seats: 1, const_ids: ['AS_3'], parties: [{ party_id: 'BJP', votes: 30, won: 1 }] },
    ] });
    expect(keys).toEqual(['election:e1:region-shares-v2:v7']);
  });

  it('returns no regions for an election whose seats carry none', async () => {
    expect(await make([]).svc.getRegionShares('e1')).toEqual({ regions: [] });
  });

  it('404 for an unknown election', async () => {
    await expect(make([], false).svc.getRegionShares('nope')).rejects.toThrow(ElectionNotFoundException);
  });

  it('counts leading seats with won ones (counting day)', async () => {
    const { svc } = make([]);
    await svc.getRegionShares('e1');
    const sql = ((svc as any).prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toMatch(/r\.status IN \('WON', 'LEADING'\)/);
  });
});
