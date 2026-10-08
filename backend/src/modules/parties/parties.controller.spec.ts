import { PartiesController } from './parties.controller';
import { Paginated, paginated } from '../../common/paginated';

describe('PartiesController.findAll', () => {
  it('returns a Paginated result (not a spread copy) when paging params are sent', async () => {
    const service = {
      findPaginated: jest.fn().mockResolvedValue(paginated([{ id: 'p1', name: 'A' }], { page: 1, limit: 2, total: 9 })),
      findAll: jest.fn(),
    };
    const out: any = await new PartiesController(service as any).findAll({ limit: 2 } as any);
    expect(out).toBeInstanceOf(Paginated);
    expect(out.meta).toEqual({ page: 1, limit: 2, total: 9 });
    expect(out.data[0].name).toBe('A');
  });
});

describe('PartiesController cache policies', () => {
  const { CACHE_CONTROL, CACHE_CONTROL_KEY } = require('../../common/http/cache-control');
  const { Reflector } = require('@nestjs/core');
  const policy = (handler: keyof PartiesController) =>
    new Reflector().getAllAndOverride(CACHE_CONTROL_KEY, [PartiesController.prototype[handler], PartiesController]);

  it('the party record (built only from Finalized elections) gets the long finished-election TTL', () => {
    expect(policy('record')).toBe(CACHE_CONTROL.FINISHED);
  });
  it('the full party list (public lookup, ~1,800 rows) gets the long reference-data TTL', () => {
    expect(policy('findAll')).toBe(CACHE_CONTROL.REFERENCE);
  });
  it('the party detail keeps the default public policy', () => {
    expect(policy('findOne')).toBe(CACHE_CONTROL.PUBLIC);
  });
});
