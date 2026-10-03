import { describe, it, expect, vi } from 'vitest';
import { IngestClient, IngestApiError } from '../client';

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
});
