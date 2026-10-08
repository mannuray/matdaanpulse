import { MemoryCounters, RateLimitCounters, RedisThrottlerStorage, type CounterStore } from './rate-limit-counters';

describe('MemoryCounters (U5 fallback)', () => {
  let now = 1_000_000;
  const mem = () => new MemoryCounters(() => now, 1000);
  beforeEach(() => { now = 1_000_000; });

  it('throttleHit counts within the window, blocks past the limit, and unblocks after the block time', () => {
    const m = mem();
    expect(m.throttleHit('k', 60_000, 2, 30_000)).toEqual({ hits: 1, ttlMs: 60_000, blockMs: 0 });
    expect(m.throttleHit('k', 60_000, 2, 30_000).hits).toBe(2);
    expect(m.throttleHit('k', 60_000, 2, 30_000)).toMatchObject({ hits: 3, blockMs: 30_000 });
    now += 10_000;
    // While blocked the count does not grow.
    expect(m.throttleHit('k', 60_000, 2, 30_000)).toMatchObject({ hits: 3, blockMs: 20_000 });
    now += 60_000;
    expect(m.throttleHit('k', 60_000, 2, 30_000)).toEqual({ hits: 1, ttlMs: 60_000, blockMs: 0 });
  });

  it('incrCounter expires after its window and is extended when the count reaches extendAt', () => {
    const m = mem();
    for (let i = 1; i <= 3; i++) expect(m.incrCounter('f', 10_000, 3, 50_000)).toBe(i);
    now += 40_000; // past the 10 s window, but the 3rd hit extended it to 50 s
    expect(m.getCounter('f')).toBe(3);
    now += 10_001;
    expect(m.getCounter('f')).toBe(0);
    m.incrCounter('f', 10_000, 3, 50_000);
    m.del('f');
    expect(m.getCounter('f')).toBe(0);
  });

  it('keeps at most maxKeys entries', () => {
    const m = mem();
    for (let i = 0; i < 1500; i++) m.incrCounter(`k${i}`, 60_000, 99, 60_000);
    expect(m.size).toBeLessThanOrEqual(1000);
  });
});

describe('RateLimitCounters: Redis when it is up, memory otherwise (U5)', () => {
  const redis = (over: Partial<CounterStore> = {}): CounterStore => ({
    isPubReady: () => true,
    throttleHit: jest.fn(async () => ({ hits: 7, ttlMs: 5000, blockMs: 0 })),
    incrCounter: jest.fn(async () => 4),
    getCounter: jest.fn(async () => 4),
    delCounter: jest.fn(async () => undefined),
    ...over,
  });

  it('uses Redis when the connection is ready (shared across instances)', async () => {
    const r = redis();
    const c = new RateLimitCounters(r);
    await expect(c.throttleHit('k', 60_000, 5, 60_000)).resolves.toEqual({ hits: 7, ttlMs: 5000, blockMs: 0 });
    await expect(c.incrCounter('f', 1000, 10, 1000)).resolves.toBe(4);
    await expect(c.getCounter('f')).resolves.toBe(4);
    await c.delCounter('f');
    expect(r.delCounter).toHaveBeenCalledWith('f');
  });

  it('falls back to memory when Redis is not ready, and when a Redis call fails', async () => {
    const down = redis({ isPubReady: () => false });
    const c1 = new RateLimitCounters(down);
    await expect(c1.throttleHit('k', 60_000, 5, 60_000)).resolves.toMatchObject({ hits: 1 });
    expect(down.throttleHit).not.toHaveBeenCalled();

    const failing = redis({ incrCounter: jest.fn().mockRejectedValue(new Error('timeout')), throttleHit: jest.fn().mockRejectedValue(new Error('x')) });
    const c2 = new RateLimitCounters(failing);
    await expect(c2.incrCounter('f', 1000, 10, 1000)).resolves.toBe(1);
    await expect(c2.incrCounter('f', 1000, 10, 1000)).resolves.toBe(2);
    await expect(c2.throttleHit('k', 60_000, 5, 60_000)).resolves.toMatchObject({ hits: 1 });
  });
});

describe('RedisThrottlerStorage (U5)', () => {
  it('namespaces the key per throttler and reports seconds as @nestjs/throttler expects', async () => {
    const throttleHit = jest.fn(async () => ({ hits: 6, ttlMs: 41_200, blockMs: 59_001 }));
    const storage = new RedisThrottlerStorage(new RateLimitCounters({ isPubReady: () => true, throttleHit } as any));
    await expect(storage.increment('abc', 60_000, 5, 60_000, 'auth')).resolves.toEqual({
      totalHits: 6, timeToExpire: 42, isBlocked: true, timeToBlockExpire: 60,
    });
    expect(throttleHit).toHaveBeenCalledWith('throttle:{auth:abc}', 60_000, 5, 60_000);
  });
});
