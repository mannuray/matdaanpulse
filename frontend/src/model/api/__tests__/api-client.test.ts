import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError, parseApiError } from '../api-client';

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
