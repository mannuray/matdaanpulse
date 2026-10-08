import { ElectionsService } from './elections.service';

describe('ElectionsService.comparableManifest', () => {
  const election = { id: 'e25', type: 'VS', state_id: 5, delimitation: '2008' };
  const make = (ok: string[]) => {
    const prisma: any = { elections: { findMany: jest.fn().mockResolvedValue(ok.map(id => ({ id }))) } };
    return { svc: new ElectionsService(prisma), prisma };
  };

  it('drops history (with its year) and compare_with entries from another delimitation; the rest is untouched', async () => {
    const { svc } = make(['e15', 'e20']);
    const m = { history: ['e10', 'e15', 'e20'], history_years: [2010, 2015, 2020], compare_with: ['e10', 'e20'], geo: { map_url: '/geo/x.geojson' } };
    expect(await svc.comparableManifest(election, m)).toEqual({ history: ['e15', 'e20'], history_years: [2015, 2020], compare_with: ['e20'], geo: m.geo });
    expect(m.history).toEqual(['e10', 'e15', 'e20']);
  });

  it('a manifest without history lists, or no manifest, is returned as is without a query', async () => {
    const { svc, prisma } = make([]);
    expect(await svc.comparableManifest(election, { leaders: [] })).toEqual({ leaders: [] });
    expect(await svc.comparableManifest(election, null)).toBeNull();
    expect(prisma.elections.findMany).not.toHaveBeenCalled();
  });
});

describe('ElectionsService.getManifest (public)', () => {
  it('returns only the parsed, comparable-filtered manifest as `draft`: never the raw stored text', async () => {
    const stored = { history: ['e10', 'e20'], history_years: [2010, 2020], geo: { map_url: '/geo/x.geojson' } };
    const prisma: any = {
      elections: {
        findUnique: jest.fn().mockResolvedValue({ id: 'e25', type: 'VS', state_id: 5, delimitation: '2008', manifest_url: JSON.stringify(stored), states: null }),
        findMany: jest.fn().mockResolvedValue([{ id: 'e20' }]),
      },
    };
    const out = await new ElectionsService(prisma).getManifest('e25');
    expect(out).toEqual({ election_id: 'e25', draft: { history: ['e20'], history_years: [2020], geo: stored.geo } });
    expect(out).not.toHaveProperty('manifest_url');
  });
});

describe('ElectionsService.findAllForAdmin', () => {
  it('every election (no 100 cap) with a manifest_published flag, without loading any manifest text', async () => {
    const rows = [{ id: 'a', year: 2026 }, { id: 'b', year: 2021 }];
    const findMany = jest.fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([{ id: 'b' }]);
    const svc = new ElectionsService({ elections: { findMany } } as any);
    const out = await svc.findAllForAdmin({ type: 'VS' as any });
    expect(out).toEqual([{ id: 'a', year: 2026, manifest_published: false }, { id: 'b', year: 2021, manifest_published: true }]);
    const [list, published] = findMany.mock.calls.map((c) => c[0]);
    expect(list.take).toBeUndefined();
    expect(list.where).toMatchObject({ type: 'VS' });
    expect(JSON.stringify(list)).not.toMatch(/manifest/);
    expect(published).toEqual({ where: { manifest_url: { not: null } }, select: { id: true } });
  });
});
