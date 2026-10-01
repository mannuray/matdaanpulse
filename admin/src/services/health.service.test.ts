import { describe, it, expect, vi, afterEach } from 'vitest';
import { getReadiness } from './health.service';

afterEach(() => vi.unstubAllGlobals());

const degraded = {
  status: 'degraded',
  checks: { database: { status: 'healthy', latencyMs: 4 }, redis: { status: 'unhealthy', latencyMs: 2000 } },
  uptimeSeconds: 10, timestamp: '2026-10-01T10:00:00.000Z',
};

describe('getReadiness', () => {
  it('a 503 with a health body is a degraded result, not an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => degraded })));
    await expect(getReadiness()).resolves.toMatchObject({ status: 'degraded', checks: { redis: { status: 'unhealthy' } } });
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toMatch(/\/health\/ready$/);
  });

  it('a body without checks (e.g. a proxy error page) throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } })));
    await expect(getReadiness()).rejects.toThrow('Health check failed (502)');
  });
});
