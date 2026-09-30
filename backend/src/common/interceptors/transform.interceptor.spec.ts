import 'reflect-metadata';
import { Controller, Get, Sse, CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, toArray } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import { paginated } from '../paginated';

@Controller()
class DummyController {
  @Sse('stream')
  stream() {}

  @Get('plain')
  plain() {}
}

function contextFor(handler: Function): ExecutionContext {
  const res = { setHeader: jest.fn() };
  return {
    getHandler: () => handler,
    getClass: () => DummyController,
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, res }) }),
  } as unknown as ExecutionContext;
}

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor<any>();

  it('passes SSE MessageEvents through untouched', async () => {
    const events = [
      { type: 'result-update', data: '{"const_id":"X"}' },
      { type: 'ping', data: '' },
    ];
    const next: CallHandler = { handle: () => of(...events) };
    const out = await lastValueFrom(
      interceptor.intercept(contextFor(DummyController.prototype.stream), next).pipe(toArray()),
    );
    expect(out).toEqual(events);
  });

  it('wraps regular responses in the success envelope', async () => {
    const next: CallHandler = { handle: () => of({ id: 1 }) };
    const out: any = await lastValueFrom(
      interceptor.intercept(contextFor(DummyController.prototype.plain), next),
    );
    expect(out.success).toBe(true);
    expect(out.data).toEqual({ id: 1 });
    expect(out.requestId).toBeDefined();
  });

  const run = (value: unknown): Promise<any> =>
    lastValueFrom(interceptor.intercept(contextFor(DummyController.prototype.plain), { handle: () => of(value) }));

  it('builds pagination only for Paginated results', async () => {
    const out = await run(paginated([1, 2], { page: 2, limit: 2, total: 5 }));
    expect(out.data).toEqual([1, 2]);
    expect(out.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('limit 0 gives totalPages 1, never NaN/Infinity', async () => {
    const out = await run(paginated([], { page: 1, limit: 0, total: 0 }));
    expect(out.pagination.totalPages).toBe(1);
  });

  it('wraps objects that merely look like envelopes verbatim', async () => {
    const weird = { success: false, data: [1], total: 9 };
    const out = await run(weird);
    expect(out.success).toBe(true);
    expect(out.data).toEqual(weird);
    expect(out.pagination).toBeUndefined();
  });

  it('wraps null', async () => {
    expect((await run(null)).data).toBeNull();
  });
});
