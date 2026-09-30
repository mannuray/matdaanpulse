import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Expose } from 'class-transformer';
import { lastValueFrom, of } from 'rxjs';
import { MapToDtoInterceptor } from './map-to-dto.interceptor';
import { Paginated, paginated } from '../../../common/paginated';

class Dto {
  @Expose() id!: string;
}

const run = (value: unknown): Promise<any> =>
  lastValueFrom(new MapToDtoInterceptor(Dto).intercept({} as ExecutionContext, { handle: () => of(value) } as CallHandler));

describe('MapToDtoInterceptor', () => {
  it('maps Paginated data and keeps the meta (stays a Paginated)', async () => {
    const out = await run(paginated([{ id: 'a', secret: 'x' }], { page: 2, limit: 5, total: 11 }));
    expect(out).toBeInstanceOf(Paginated);
    expect(out.meta).toEqual({ page: 2, limit: 5, total: 11 });
    expect(out.data).toHaveLength(1);
    expect(out.data[0]).toBeInstanceOf(Dto);
    expect(out.data[0]).toEqual({ id: 'a' });
  });

  it('maps a single object and passes null through', async () => {
    expect(await run({ id: 'b', secret: 'x' })).toEqual({ id: 'b' });
    expect(await run(null)).toBeNull();
  });
});
