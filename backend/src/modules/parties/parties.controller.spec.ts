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
