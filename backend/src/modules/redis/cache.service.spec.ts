import { Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

const status = { recordCacheHit: jest.fn(), recordCacheMiss: jest.fn(), recordCacheFallback: jest.fn() } as any;

function make(redis: Partial<Record<'get' | 'set' | 'del' | 'delByPattern', jest.Mock>>) {
  const svc = new CacheService(redis as any, status);
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  return { svc, warn };
}

afterEach(() => jest.restoreAllMocks());

describe('CacheService.getOrSet', () => {
  it('returns the cached value without calling the loader', async () => {
    const { svc } = make({ get: jest.fn().mockResolvedValue('{"a":1}'), set: jest.fn() });
    const loader = jest.fn();
    await expect(svc.getOrSet('k', 60, loader)).resolves.toEqual({ a: 1 });
    expect(loader).not.toHaveBeenCalled();
  });

  it('loads and stores on a miss', async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    const { svc } = make({ get: jest.fn().mockResolvedValue(null), set });
    await expect(svc.getOrSet('k', 60, async () => [1, 2])).resolves.toEqual([1, 2]);
    expect(set).toHaveBeenCalledWith('k', '[1,2]', 60);
  });

  it('falls back to the loader when the Redis read fails', async () => {
    const { svc } = make({ get: jest.fn().mockRejectedValue(new Error('down')), set: jest.fn().mockRejectedValue(new Error('down')) });
    await expect(svc.getOrSet('k', 60, async () => 'db')).resolves.toBe('db');
  });

  it('still returns the loaded value when the Redis write fails', async () => {
    const { svc } = make({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockRejectedValue(new Error('down')) });
    await expect(svc.getOrSet('k', 60, async () => 'db')).resolves.toBe('db');
  });

  it('treats an unparseable cached value as a miss', async () => {
    const { svc } = make({ get: jest.fn().mockResolvedValue('{not json'), set: jest.fn().mockResolvedValue(undefined) });
    await expect(svc.getOrSet('k', 60, async () => 'db')).resolves.toBe('db');
  });

  it('propagates loader (database) errors', async () => {
    const { svc } = make({ get: jest.fn().mockResolvedValue(null), set: jest.fn() });
    await expect(svc.getOrSet('k', 60, async () => { throw new Error('db down'); })).rejects.toThrow('db down');
  });

  it('logs a Redis failure once per minute, not per request', async () => {
    const { svc, warn } = make({ get: jest.fn().mockRejectedValue(new Error('down')), set: jest.fn().mockRejectedValue(new Error('down')) });
    for (let i = 0; i < 5; i++) await svc.getOrSet(`k${i}`, 60, async () => i);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('CacheService invalidation', () => {
  it('logs a warning and retries a failed invalidation once in the background', async () => {
    jest.useFakeTimers();
    const del = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(undefined);
    const delByPattern = jest.fn().mockRejectedValue(new Error('down'));
    const { svc, warn } = make({ del, delByPattern });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await expect(svc.del('k')).resolves.toBe(false);
    await expect(svc.delByPattern('election:1:*')).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();
    expect(del).toHaveBeenCalledTimes(2);
    expect(delByPattern).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(3); // pattern retry failed too; only one retry each
    jest.advanceTimersByTime(10_000);
    expect(delByPattern).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('del / delByPattern swallow Redis errors', async () => {
    jest.useFakeTimers();
    const { svc } = make({ del: jest.fn().mockRejectedValue(new Error('down')), delByPattern: jest.fn().mockRejectedValue(new Error('down')) });
    await expect(svc.del('k')).resolves.toBe(false);
    await expect(svc.delByPattern('election:1:*')).resolves.toBe(false);
    jest.useRealTimers();
  });

  it('del returns true on success', async () => {
    const { svc } = make({ del: jest.fn().mockResolvedValue(undefined) });
    await expect(svc.del('k')).resolves.toBe(true);
  });
});

describe('CacheService single-flight', () => {
  it('collapses 50 concurrent misses for one key into one Redis read and one loader call', async () => {
    const get = jest.fn().mockResolvedValue(null);
    const set = jest.fn().mockResolvedValue(undefined);
    const { svc } = make({ get, set });
    let release!: (v: number[]) => void;
    const loader = jest.fn(() => new Promise<number[]>((r) => { release = r; }));
    const calls = Array.from({ length: 50 }, () => svc.getOrSet('k', 60, loader));
    await new Promise((r) => setImmediate(r));
    release([1, 2]);
    const out = await Promise.all(calls);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(out.every((v) => JSON.stringify(v) === '[1,2]')).toBe(true);
  });

  it('different keys load independently', async () => {
    const { svc } = make({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) });
    const loader = jest.fn(async () => 1);
    await Promise.all([svc.getOrSet('a', 60, loader), svc.getOrSet('b', 60, loader)]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('a rejected load is shared by its waiters and not remembered', async () => {
    const { svc } = make({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) });
    const failing = jest.fn(async () => { throw new Error('db down'); });
    const both = await Promise.allSettled([svc.getOrSet('k', 60, failing), svc.getOrSet('k', 60, failing)]);
    expect(both.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(failing).toHaveBeenCalledTimes(1);
    await expect(svc.getOrSet('k', 60, async () => 'ok')).resolves.toBe('ok');
  });

  it('an invalidation during a load: the stale value is not written, and later callers start a fresh load', async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    const { svc } = make({ get: jest.fn().mockResolvedValue(null), set, delByPattern: jest.fn().mockResolvedValue(undefined) });
    let release!: (v: string) => void;
    const first = svc.getOrSet('election:1:x', 60, () => new Promise<string>((r) => { release = r; }));
    await new Promise((r) => setImmediate(r));
    await svc.delByPattern('election:1:*');
    const fresh = svc.getOrSet('election:1:x', 60, async () => 'new');
    release('old');
    await expect(first).resolves.toBe('old');
    await expect(fresh).resolves.toBe('new');
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('election:1:x', '"new"', 60);
  });

  it('purging election A does not detach or skip the write-back of election B (I3)', async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    const { svc } = make({ get: jest.fn().mockResolvedValue(null), set, delByPattern: jest.fn().mockResolvedValue(undefined) });
    let release!: (v: string) => void;
    const loaderB = jest.fn(() => new Promise<string>((r) => { release = r; }));
    const first = svc.getOrSet('election:B:summary', 60, loaderB);
    await new Promise((r) => setImmediate(r));
    await svc.delByPattern('election:A:*');
    const joined = svc.getOrSet('election:B:summary', 60, loaderB); // still single-flight
    release('b');
    await expect(Promise.all([first, joined])).resolves.toEqual(['b', 'b']);
    expect(loaderB).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('election:B:summary', '"b"', 60);
  });

  it('content-addressed keys (:v<version>) stay single-flight and are written back across a purge of their election', async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    const { svc } = make({ get: jest.fn().mockResolvedValue(null), set, delByPattern: jest.fn().mockResolvedValue(undefined) });
    let release!: (v: string) => void;
    const loader = jest.fn(() => new Promise<string>((r) => { release = r; }));
    const first = svc.getOrSet('election:A:snapshot:v7', 60, loader);
    await new Promise((r) => setImmediate(r));
    await svc.delByPattern('election:A:*');
    const joined = svc.getOrSet('election:A:snapshot:v7', 60, loader);
    release('snap');
    await Promise.all([first, joined]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('election:A:snapshot:v7', '"snap"', 60);
  });

  it('invalidation bookkeeping is bounded', async () => {
    const { svc } = make({ del: jest.fn().mockResolvedValue(undefined), delByPattern: jest.fn().mockResolvedValue(undefined) });
    for (let i = 0; i < 1500; i++) {
      await svc.del(`election:${i}:public-analysis`);
      await svc.delByPattern(`election:${i}:summary:*`);
    }
    expect((svc as any).invalidatedKeys.size).toBeLessThanOrEqual(1000);
    expect((svc as any).invalidatedPrefixes.size).toBeLessThanOrEqual(1000);
  });

  it('del(key) only affects that key', async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    const { svc } = make({ get: jest.fn().mockResolvedValue(null), set, del: jest.fn().mockResolvedValue(undefined) });
    let release!: (v: number) => void;
    const p = svc.getOrSet('k2', 60, () => new Promise<number>((r) => { release = r; }));
    await new Promise((r) => setImmediate(r));
    await svc.del('k1');
    release(2);
    await p;
    expect(set).toHaveBeenCalledWith('k2', '2', 60);
  });
});
