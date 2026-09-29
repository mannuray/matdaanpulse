import 'reflect-metadata';
import { Controller, Get, Sse, CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, toArray } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

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
});
