import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError, parseApiError, parseRetryAfter } from '../api-client';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: status < 400, status, statusText: '', json: async () => body })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('apiFetch', () => {
  it('throws ApiError with code, fields and requestId for a validation error', async () => {
    mockFetch(400, {
      success: false,
      error: {
        code: 'VALIDATION_9001',
        message: 'Validation failed',
        requestId: 'r1',
        fields: [{ field: 'limit', message: 'limit must not be greater than 200' }],
      },
    });
    const err = (await apiFetch('/x').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Validation failed');
    expect(err.code).toBe('VALIDATION_9001');
    expect(err.fields).toEqual([{ field: 'limit', message: 'limit must not be greater than 200' }]);
    expect(err.requestId).toBe('r1');
  });

  it('falls back to a status message for non-envelope bodies', () => {
    expect(parseApiError(502, 'Bad Gateway', { _jsonParseFailed: true }).message).toBe('API error: 502 Bad Gateway');
  });

  it('returns paginated envelopes whole and unwraps plain ones', async () => {
    const list = { success: true, data: [1], pagination: { page: 1, limit: 1, total: 1, totalPages: 1 } };
    mockFetch(200, list);
    expect(await apiFetch('/x')).toEqual(list);
    mockFetch(200, { success: true, data: { id: 1 } });
    expect(await apiFetch('/x')).toEqual({ id: 1 });
  });
});

describe('describeApiError', () => {
  it('appends field errors and falls back for non-errors', async () => {
    const { describeApiError } = await import('../api-client');
    const err = parseApiError(400, '', { error: { message: 'Validation failed', fields: [{ field: 'limit', message: 'too big' }] } });
    expect(describeApiError(err)).toBe('Validation failed (limit: too big)');
    expect(describeApiError(new Error('boom'))).toBe('boom');
    expect(describeApiError('x')).toBe('An error occurred');
  });
});

describe('apiFetch for CDN-cached polling', () => {
  it('a GET sends no Content-Type (a CORS simple request: no preflight)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, statusText: '', json: async () => ({ success: true, data: 1 }) }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/elections/x/live');
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({});
    await apiFetch('/x', { method: 'POST', body: '{}' });
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('a 429 carries retryAfterMs from Retry-After', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 429, statusText: '', headers: new Headers({ 'Retry-After': '30' }),
      json: async () => ({ success: false, error: { code: 'X', message: 'Too Many Requests' } }),
    })));
    const err = (await apiFetch('/x').catch((e) => e)) as ApiError;
    expect(err.status).toBe(429);
    expect(err.retryAfterMs).toBe(30_000);
  });

  it('parseRetryAfter reads seconds or an HTTP date', () => {
    expect(parseRetryAfter('12')).toBe(12_000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
    const now = Date.parse('2026-09-30T00:00:00Z');
    expect(parseRetryAfter('Wed, 30 Sep 2026 00:00:20 GMT', now)).toBe(20_000);
  });
});
