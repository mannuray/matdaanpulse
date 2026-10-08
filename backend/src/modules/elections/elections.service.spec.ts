import { ElectionsService } from './elections.service';

describe('ElectionsService.parseManifest', () => {
  const svc = new ElectionsService({} as any);

  it('parses JSON text into an object', () => {
    expect(svc.parseManifest('{"a":[1,2]}')).toEqual({ a: [1, 2] });
  });

  it('returns null for absent, empty, bad or non-object values without throwing', () => {
    for (const v of [null, undefined, '', '{not json', '"str"', '5', 'null', '[]', '[1,2]']) expect(svc.parseManifest(v)).toBeNull();
  });
});

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
