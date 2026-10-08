import { correlationFormat, resolveLogLevel } from './winston.config';
import { requestContext } from './request-context';
import { trace } from '@opentelemetry/api';

describe('winston config', () => {
  it('LOG_LEVEL defaults to info and accepts known levels', () => {
    expect(resolveLogLevel(undefined)).toBe('info');
    expect(resolveLogLevel('DEBUG')).toBe('debug');
    expect(resolveLogLevel('loud')).toBe('info');
  });

  it('adds the requestId from the request context', () => {
    const fmt = correlationFormat();
    const out = requestContext.run({ requestId: 'req-1' }, () =>
      fmt.transform({ level: 'info', message: 'hi' } as any),
    ) as any;
    expect(out.requestId).toBe('req-1');
  });

  it('leaves lines outside a request untouched', () => {
    const out = correlationFormat().transform({ level: 'info', message: 'hi' } as any) as any;
    expect(out.requestId).toBeUndefined();
    expect(out.trace_id).toBeUndefined();
  });

  it('inside an active span: trace_id and span_id (log ↔ trace correlation)', () => {
    const spanContext = { traceId: '0af7651916cd43dd8448eb211c80319c', spanId: 'b7ad6b7169203331', traceFlags: 1 };
    const span = trace.wrapSpanContext(spanContext);
    const getActiveSpan = jest.spyOn(trace, 'getActiveSpan').mockReturnValue(span);
    const out = correlationFormat().transform({ level: 'info', message: 'hi' } as any) as any;
    expect(out).toMatchObject({ trace_id: spanContext.traceId, span_id: spanContext.spanId });
    getActiveSpan.mockRestore();
  });
});
