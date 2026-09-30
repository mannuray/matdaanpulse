import { correlationFormat, resolveLogLevel } from './winston.config';
import { requestContext } from './request-context';

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
});
