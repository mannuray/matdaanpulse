import { Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

function make(redis: Partial<Record<'get' | 'set' | 'del' | 'delByPattern', jest.Mock>>) {
  const svc = new CacheService(redis as any);
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
  it('del / delByPattern swallow Redis errors', async () => {
    const { svc } = make({ del: jest.fn().mockRejectedValue(new Error('down')), delByPattern: jest.fn().mockRejectedValue(new Error('down')) });
    await expect(svc.del('k')).resolves.toBe(false);
    await expect(svc.delByPattern('election:1:*')).resolves.toBe(false);
  });

  it('del returns true on success', async () => {
    const { svc } = make({ del: jest.fn().mockResolvedValue(undefined) });
    await expect(svc.del('k')).resolves.toBe(true);
  });
});
