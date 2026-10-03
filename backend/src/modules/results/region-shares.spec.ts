import { ResultsService } from './results.service';

describe('ResultsService.getRegionShares', () => {
  function make(rows: unknown[]) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) };
    const keys: string[] = [];
    const cache = { getOrSet: jest.fn(async (key: string, _ttl: number, loader: () => Promise<unknown>) => { keys.push(key); return loader(); }) };
    const liveState = { get: jest.fn().mockResolvedValue({ version: 7 }) };
    return { svc: new ResultsService(prisma as any, cache as any, liveState as any), keys };
  }

  it('groups each region\'s party votes and seats won, cached under the live version', async () => {
    const { svc, keys } = make([
      { region_id: 1, region_name: 'Upper Assam', seats: 2n, party_id: 'BJP', votes: 100n, won: 2n },
      { region_id: 1, region_name: 'Upper Assam', seats: 2n, party_id: 'INC', votes: 50n, won: 0n },
      { region_id: 2, region_name: 'Hills', seats: 1n, party_id: 'BJP', votes: 30n, won: 1n },
    ]);
    expect(await svc.getRegionShares('e1')).toEqual({ regions: [
      { id: 1, name: 'Upper Assam', seats: 2, parties: [{ party_id: 'BJP', votes: 100, won: 2 }, { party_id: 'INC', votes: 50, won: 0 }] },
      { id: 2, name: 'Hills', seats: 1, parties: [{ party_id: 'BJP', votes: 30, won: 1 }] },
    ] });
    expect(keys).toEqual(['election:e1:region-shares:v7']);
  });

  it('returns no regions for an election whose seats carry none', async () => {
    expect(await make([]).svc.getRegionShares('e1')).toEqual({ regions: [] });
  });
});
