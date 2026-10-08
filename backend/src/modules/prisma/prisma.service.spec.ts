import { attachPrismaLogs, prismaLogConfig } from './prisma.service';

describe('prismaLogConfig', () => {
  it('enables query events only when LOG_LEVEL is debug (any case)', () => {
    expect(prismaLogConfig('debug')).toContainEqual({ emit: 'event', level: 'query' });
    expect(prismaLogConfig(' DEBUG ')).toContainEqual({ emit: 'event', level: 'query' });
    expect(prismaLogConfig('info')).not.toContainEqual({ emit: 'event', level: 'query' });
    expect(prismaLogConfig(undefined)).not.toContainEqual({ emit: 'event', level: 'query' });
  });

  it('never prints to stdout itself: info, warn and error are events for the app logger (one JSON stream)', () => {
    const cfg = prismaLogConfig('info');
    expect(cfg.every((d) => d.emit === 'event')).toBe(true);
    expect(cfg.map((d) => d.level).sort()).toEqual(['error', 'info', 'warn']);
  });
});

describe('attachPrismaLogs', () => {
  function setup(now = { t: 0 }) {
    const handlers: Record<string, (e: any) => void> = {};
    const client = { $on: (ev: string, fn: (e: any) => void) => { handlers[ev] = fn; } };
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    attachPrismaLogs(client as any, logger as any, { debug: true, now: () => now.t });
    return { handlers, logger, now };
  }

  it('an engine error is one error line: first line only (the rest can carry query arguments), once a minute per message', () => {
    const { handlers, logger, now } = setup();
    const e = { message: 'Timed out fetching a new connection from the connection pool.\nparams: ["voter@example.com"]', target: 'quaint' };
    for (let i = 0; i < 100; i++) handlers.error(e);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toMatchObject({ message: 'Prisma: Timed out fetching a new connection from the connection pool.', event: 'prisma_error' });
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/voter@example/);
    now.t += 60_001;
    handlers.error(e);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('warn is rate-limited the same way; info goes to the normal log', () => {
    const { handlers, logger } = setup();
    handlers.warn({ message: 'slow' });
    handlers.warn({ message: 'slow' });
    handlers.info({ message: 'Starting a postgresql pool with 9 connections.' });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledTimes(1);
  });

  it('the debug query log never includes the parameters', () => {
    const { handlers, logger } = setup();
    handlers.query({ query: 'SELECT * FROM users WHERE email = $1', params: '["voter@example.com"]', duration: 4 });
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.debug.mock.calls)).toMatch(/SELECT \* FROM users/);
    expect(JSON.stringify(logger.debug.mock.calls)).not.toMatch(/voter@example/);
  });
});
