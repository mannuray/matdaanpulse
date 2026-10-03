import { describe, it, expect, vi, afterEach } from 'vitest';
import { acquireSeatLock, releaseSeatLock } from './election.service';
import { ApiError } from './api-client';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const fn = vi.fn(async () => ({ ok: status < 400, status, statusText: '', json: async () => body }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());

describe('live service', () => {
  it('acquireSeatLock surfaces the holder on 409', async () => {
    mockFetch(409, { success: false, error: { code: 'RESULT_6002', message: 'Seat is being edited by someone else', details: { lock: { user_name: 'Priya S' } } } });
    const err = await acquireSeatLock('e1', 'c1').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.details.lock.user_name).toBe('Priya S');
  });

  it('releaseSeatLock can use keepalive', async () => {
    const fn = mockFetch(204, {});
    await releaseSeatLock('e1', 'c1', { keepalive: true });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/admin\/live\/locks\/release$/);
    expect(init.keepalive).toBe(true);
  });
});
