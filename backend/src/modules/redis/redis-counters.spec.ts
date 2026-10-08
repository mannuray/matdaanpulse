import Redis from 'ioredis';
import { RedisService } from './redis.service';

function makeService(pub: Record<string, unknown>) {
  const svc = new RedisService({ get: () => undefined } as any, {} as any);
  (svc as any).pub = { status: 'ready', ...pub };
  return svc;
}

describe('RedisService rate-limit counters (U5)', () => {
  it('throttleHit runs one script over the hit and block keys (same hash slot) and maps the reply', async () => {
    const evalFn = jest.fn().mockResolvedValue([3, 59000, 0]);
    const svc = makeService({ eval: evalFn });
    await expect(svc.throttleHit('throttle:{auth:k}', 60_000, 5, 30_000)).resolves.toEqual({ hits: 3, ttlMs: 59000, blockMs: 0 });
    expect(evalFn).toHaveBeenCalledWith(expect.stringContaining('INCR'), 2, 'throttle:{auth:k}:hits', 'throttle:{auth:k}:block', '60000', '5', '30000');
  });

  it('incrCounter / getCounter / delCounter', async () => {
    const evalFn = jest.fn().mockResolvedValue(4);
    const get = jest.fn().mockResolvedValueOnce('4').mockResolvedValueOnce(null);
    const del = jest.fn().mockResolvedValue(1);
    const svc = makeService({ eval: evalFn, get, del });
    await expect(svc.incrCounter('login:fail:x', 900_000, 10, 900_000)).resolves.toBe(4);
    expect(evalFn).toHaveBeenCalledWith(expect.stringContaining('PEXPIRE'), 1, 'login:fail:x', '900000', '10', '900000');
    await expect(svc.getCounter('login:fail:x')).resolves.toBe(4);
    await expect(svc.getCounter('login:fail:x')).resolves.toBe(0);
    await svc.delCounter('login:fail:x');
    expect(del).toHaveBeenCalledWith('login:fail:x');
  });
});

/**
 * The Lua scripts against a real Redis (local docker). Skipped when none answers; REQUIRE_REDIS_TESTS=1 makes a
 * missing Redis a failure.
 */
describe('RedisService rate-limit scripts (real Redis)', () => {
  let client: Redis | null = null;
  beforeAll(async () => {
    const c = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379, lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 500 });
    c.on('error', () => undefined);
    try { await c.connect(); await c.ping(); client = c; } catch { c.disconnect(); }
  });
  afterAll(() => client?.disconnect());

  it('counts, blocks and extends as the memory fallback does', async () => {
    if (!client) {
      if (process.env.REQUIRE_REDIS_TESTS === '1') throw new Error('REQUIRE_REDIS_TESTS=1 but no Redis is reachable');
      console.warn('SKIPPED (no Redis): rate-limit scripts');
      return;
    }
    const svc = makeService({});
    (svc as any).pub = client;
    const k = `test:throttle:{${Date.now()}:${Math.random()}}`;
    expect(await svc.throttleHit(k, 60_000, 2, 30_000)).toMatchObject({ hits: 1, blockMs: 0 });
    expect(await svc.throttleHit(k, 60_000, 2, 30_000)).toMatchObject({ hits: 2, blockMs: 0 });
    const third = await svc.throttleHit(k, 60_000, 2, 30_000);
    expect(third.hits).toBe(3);
    expect(third.blockMs).toBeGreaterThan(29_000);
    expect((await svc.throttleHit(k, 60_000, 2, 30_000)).hits).toBe(3); // blocked: not counted
    const f = `test:login:${Date.now()}:${Math.random()}`;
    expect(await svc.incrCounter(f, 1000, 2, 60_000)).toBe(1);
    expect(await svc.incrCounter(f, 1000, 2, 60_000)).toBe(2);
    expect(await client.pttl(f)).toBeGreaterThan(50_000); // extended at the 2nd failure
    expect(await svc.getCounter(f)).toBe(2);
    await svc.delCounter(f);
    expect(await svc.getCounter(f)).toBe(0);
    await client.del(`${k}:hits`, `${k}:block`);
  });
});
