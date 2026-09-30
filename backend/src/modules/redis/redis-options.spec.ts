import { buildRedisConnection } from './redis-options';

describe('buildRedisConnection', () => {
  it('uses REDIS_URL when set (rediss:// enables TLS)', () => {
    const c = buildRedisConnection({ REDIS_URL: 'rediss://default:tok@db.upstash.io:6379', REDIS_HOST: 'ignored' });
    expect(c.url).toBe('rediss://default:tok@db.upstash.io:6379');
    expect(c.pub.tls).toEqual({});
    expect(c.sub.tls).toEqual({});
    expect(c.description).toBe('rediss://db.upstash.io:6379'); // no credentials
  });

  it('plain redis:// URL has no TLS', () => {
    const c = buildRedisConnection({ REDIS_URL: 'redis://localhost:6380' });
    expect(c.url).toBe('redis://localhost:6380');
    expect(c.pub.tls).toBeUndefined();
  });

  it('rejects a non-redis URL scheme', () => {
    expect(() => buildRedisConnection({ REDIS_URL: 'http://x:1' })).toThrow(/REDIS_URL/);
  });

  it('falls back to REDIS_HOST / REDIS_PORT / REDIS_PASSWORD', () => {
    const c = buildRedisConnection({ REDIS_HOST: 'cache', REDIS_PORT: '3084', REDIS_PASSWORD: 'pw' });
    expect(c.url).toBeUndefined();
    expect(c.pub).toMatchObject({ host: 'cache', port: 3084, password: 'pw' });
    expect(c.sub).toMatchObject({ host: 'cache', port: 3084, password: 'pw' });
    expect(c.description).toBe('redis://cache:3084');
  });

  it('defaults to localhost:6379 without a password', () => {
    const c = buildRedisConnection({});
    expect(c.pub).toMatchObject({ host: 'localhost', port: 6379 });
    expect(c.pub.password).toBeUndefined();
  });

  it('command connection fails fast; subscriber keeps its offline queue', () => {
    const { pub, sub } = buildRedisConnection({});
    expect(pub).toMatchObject({
      lazyConnect: true, keepAlive: 10000, connectTimeout: 5000,
      maxRetriesPerRequest: 1, enableOfflineQueue: false, commandTimeout: 1000,
    });
    expect(sub).toMatchObject({ lazyConnect: true, keepAlive: 10000, connectTimeout: 5000, maxRetriesPerRequest: 1, autoResubscribe: true });
    expect(sub.enableOfflineQueue).toBeUndefined();
    expect(sub.commandTimeout).toBeUndefined();
  });
});
