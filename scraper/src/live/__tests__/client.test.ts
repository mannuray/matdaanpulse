import { describe, it, expect, vi } from 'vitest';
import { IngestClient, IngestApiError, parseRetryAfter } from '../client';

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const err = (status: number, code: string) => new Response(JSON.stringify({ success: false, error: { code, message: 'x', details: { holder: 'other' } } }), { status });

describe('IngestClient', () => {
  it('sends the Bearer key and unwraps data', async () => {
    const f = vi.fn(async () => ok({ status: 'Live' }));
    const c = new IngestClient({ baseUrl: 'http://api/api/v1', key: 'mpk_k', fetch: f as any });
    expect(await c.config('e', 'rest')).toEqual({ status: 'Live' });
    expect(f).toHaveBeenCalledWith('http://api/api/v1/ingest/elections/e/config?shard=rest', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer mpk_k' }) }));
  });
  it('a 409 is thrown at once with its code and details; 5xx and network errors are retried', async () => {
    const c409 = new IngestClient({ baseUrl: 'http://api', key: 'k', fetch: vi.fn(async () => err(409, 'INGEST_0004')) as any, sleep: async () => {} });
    await expect(c409.lease('e', 'rest', 'w')).rejects.toMatchObject({ status: 409, code: 'INGEST_0004', details: { holder: 'other' } });
    const f = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(err(503, 'GEN_0001')).mockResolvedValueOnce(ok({ expires_at: 't' }));
    const c = new IngestClient({ baseUrl: 'http://api', key: 'k', fetch: f as any, sleep: async () => {} });
    expect(await c.lease('e', 'rest', 'w')).toEqual({ expires_at: 't' });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('gives up after the retries with an IngestApiError', async () => {
    const c = new IngestClient({ baseUrl: 'http://api', key: 'k', retries: 2, fetch: vi.fn(async () => err(502, 'GEN_0001')) as any, sleep: async () => {} });
    await expect(c.config('e', 'rest')).rejects.toBeInstanceOf(IngestApiError);
  });
  it('aborts a hung request after timeoutMs and retries it', async () => {
    const f = vi.fn((_url: string, init: RequestInit) => {
      if (f.mock.calls.length === 1) return new Promise<Response>((_res, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))));
      return Promise.resolve(ok({ expires_at: 't' }));
    });
    const c = new IngestClient({ baseUrl: 'http://api', key: 'k', timeoutMs: 20, fetch: f as any, sleep: async () => {} });
    expect(await c.lease('e', 'rest', 'w')).toEqual({ expires_at: 't' });
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe('IngestClient 429 / 408', () => {
  it('retries a 429 after its Retry-After, and a 408 with backoff', async () => {
    const sleeps: number[] = [];
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'GEN_0429', message: 'slow down' } }), { status: 429, headers: { 'Retry-After': '7' } }))
      .mockResolvedValueOnce(new Response('', { status: 408 }))
      .mockResolvedValueOnce(ok({ expires_at: 't' }));
    const c = new IngestClient({ baseUrl: 'http://api', key: 'k', fetch: f as any, sleep: async ms => { sleeps.push(ms); } });
    expect(await c.lease('e', 'rest', 'w')).toEqual({ expires_at: 't' });
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleeps[0]).toBe(7_000);
    expect(sleeps[1]).toBeGreaterThanOrEqual(2_000); expect(sleeps[1]).toBeLessThan(2_250);
  });
  it('parses Retry-After seconds and dates, capped at 60 s', () => {
    expect(parseRetryAfter('3')).toBe(3_000);
    expect(parseRetryAfter('600')).toBe(60_000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 5_000)).toBe(5_000);
    expect(parseRetryAfter('soon')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });
});
