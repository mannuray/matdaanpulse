import { buildThrottlerModuleOptions } from './throttle.config';
import { RedisThrottlerStorage } from './rate-limit-counters';

describe('buildThrottlerModuleOptions (U5)', () => {
  it('uses the Redis-backed storage (memory fallback inside) with the three named throttlers', () => {
    const opts = buildThrottlerModuleOptions({ THROTTLE_AUTH_PER_MIN: '7' }, { isPubReady: () => false } as any);
    expect(opts.storage).toBeInstanceOf(RedisThrottlerStorage);
    expect(opts.throttlers.map((t) => [t.name, t.limit])).toEqual([['public', 600], ['auth', 7], ['feedback', 5]]);
  });
});
