const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3082/api/v1';

export interface FieldError {
  field: string;
  message: string;
}

interface RawError {
  code?: string;
  message?: string;
  requestId?: string;
  fields?: Partial<FieldError>[];
  details?: Record<string, unknown>;
}

/** Error body from the backend: { success: false, error: { code, message, fields?, details?, ... } }. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly fields: FieldError[] = [],
    public readonly details?: Record<string, unknown>,
    public readonly requestId?: string,
    /** From a Retry-After header (429/503): how long the server asks us to wait. */
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Retry-After as milliseconds: delta-seconds or an HTTP date; undefined when absent/invalid. */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

export function parseApiError(status: number, statusText: string, body: unknown, retryAfterMs?: number): ApiError {
  const e = (body as { error?: RawError } | null | undefined)?.error;
  const fields: FieldError[] = Array.isArray(e?.fields)
    ? e.fields.filter((f): f is FieldError => !!f && typeof f.field === 'string' && typeof f.message === 'string')
    : [];
  const message =
    (typeof e?.message === 'string' && e.message) || `API error: ${status}${statusText ? ` ${statusText}` : ''}`;
  return new ApiError(message, status, e?.code, fields, e?.details, e?.requestId, retryAfterMs);
}

/** One line for UI state: the message, with backend field errors appended. */
export function describeApiError(err: unknown, fallback = 'An error occurred'): string {
  if (err instanceof ApiError && err.fields.length > 0) {
    return `${err.message} (${err.fields.map((f) => `${f.field}: ${f.message}`).join('; ')})`;
  }
  return err instanceof Error ? err.message : fallback;
}

/**
 * CORE MODEL: apiFetch (SOLID: DIP)
 * Standardized network requester for the frontend.
 * Designed for consistency with the admin-side architecture.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Only requests with a body declare a content type: a GET without custom headers is a
  // CORS "simple" request, so viewers' polls cause no preflight (OPTIONS is never CDN-cached).
  const headers: Record<string, string> = options?.body !== undefined ? { 'Content-Type': 'application/json' } : {};

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  const result = await response.json().catch(() => ({ _jsonParseFailed: true }));

  if (!response.ok) {
    throw parseApiError(response.status, response.statusText, result, parseRetryAfter(response.headers?.get?.('Retry-After')));
  }

  // Handle standard backend wrapping (consistent with admin api-client)
  if (result.success && result.pagination) {
    return result as T;
  }
  return (result.success !== undefined ? result.data : result) as T;
}

export { API_BASE_URL };
