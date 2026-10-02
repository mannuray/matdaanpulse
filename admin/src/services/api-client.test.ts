import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError, fieldErrorMap, parseApiError, withCacheBuster } from './api-client';
import { describeError } from '../utils/api-error';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status < 400,
    status,
    statusText: '',
    json: async () => body,
  })));
}

afterEach(() => vi.unstubAllGlobals());

const validationBody = {
  success: false,
  error: {
    code: 'VALIDATION_9001',
    message: 'Validation failed',
    requestId: 'r1',
    fields: [
      { field: 'email', message: 'email must be an email' },
      { field: 'items[1].name', message: 'name must be a string' },
    ],
  },
};

describe('apiFetch error handling', () => {
  it('throws ApiError with code, fields and requestId for a validation body', async () => {
    mockFetch(400, validationBody);
    const err = (await apiFetch('/x').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Validation failed');
    expect(err.code).toBe('VALIDATION_9001');
    expect(err.requestId).toBe('r1');
    expect(err.fields).toHaveLength(2);
    expect(err.details).toBeUndefined();
  });

  it('carries business details', async () => {
    mockFetch(409, { success: false, error: { code: 'GEN_0004', message: 'Conflict', details: { id: 'a' } } });
    const err = (await apiFetch('/x').catch((e) => e)) as ApiError;
    expect(err.details).toEqual({ id: 'a' });
    expect(err.fields).toEqual([]);
  });

  it('falls back to a status message when the body is not an error envelope', () => {
    const err = parseApiError(502, 'Bad Gateway', { _jsonParseFailed: true });
    expect(err.message).toBe('API error: 502 Bad Gateway');
  });

  it('still returns paginated envelopes whole and unwraps plain ones', async () => {
    const list = { success: true, data: [1], pagination: { page: 1, limit: 1, total: 1, totalPages: 1 } };
    mockFetch(200, list);
    expect(await apiFetch('/x')).toEqual(list);
    mockFetch(200, { success: true, data: { id: 1 } });
    expect(await apiFetch('/x')).toEqual({ id: 1 });
  });
});

describe('field error helpers', () => {
  it('fieldErrorMap keeps the first message per field', () => {
    const err = parseApiError(400, '', {
      error: { fields: [{ field: 'a', message: 'one' }, { field: 'a', message: 'two' }, { field: 'b', message: 'x' }] },
    });
    expect(fieldErrorMap(err)).toEqual({ a: 'one', b: 'x' });
    expect(fieldErrorMap(new Error('x'))).toEqual({});
  });

  it('describeError lists fields under the message', () => {
    const err = parseApiError(400, '', validationBody);
    expect(describeError(err, 'Operation failed')).toBe(
      'Operation failed: Validation failed\n• email: email must be an email\n• items[1].name: name must be a string',
    );
    expect(describeError(new Error('boom'), 'Operation failed')).toBe('Operation failed: boom');
    expect(describeError(new TypeError('Failed to fetch'), 'Operation failed')).toBe('Network error \u2014 check your connection');
    expect(describeError(new Error('Unauthorized'), 'Operation failed')).toBe('Session expired \u2014 please sign in again');
    expect(describeError('weird', 'Operation failed')).toBe('Operation failed');
  });
});

describe('admin GETs bypass shared caches', () => {
  it('appends _=<timestamp> to GETs only', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, statusText: '', json: async () => ({ success: true, data: 1 }) }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/elections');
    await apiFetch('/elections?type=VS');
    await apiFetch('/admin/elections/x', { method: 'PATCH', body: '{}' });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/elections\?_=\d+$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/elections\?type=VS&_=\d+$/);
    expect(fetchMock.mock.calls[2][0]).toMatch(/\/admin\/elections\/x$/);
  });

  it('withCacheBuster', () => {
    expect(withCacheBuster('/a', 5)).toBe('/a?_=5');
    expect(withCacheBuster('/a?b=1', 5)).toBe('/a?b=1&_=5');
  });
});

describe('apiFetch headers', () => {
  it('sends JSON content type for JSON bodies and merges caller headers', async () => {
    mockFetch(200, { success: true, data: {} });
    await apiFetch('/x', { method: 'POST', body: '{}', headers: { 'X-Test': '1' } });
    const init = (fetch as any).mock.calls[0][1] as RequestInit;
    const h = init.headers as Record<string, string>;
    expect(h['Content-Type']).toBe('application/json');
    expect(h['X-Test']).toBe('1');
  });
});
