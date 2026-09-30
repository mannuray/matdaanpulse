import { getToken, handleUnauthorized } from './auth.service';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3082/api/v1';

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FieldError {
  field: string;
  message: string;
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
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function parseApiError(status: number, statusText: string, body: any): ApiError {
  const e = body?.error;
  const fields: FieldError[] = Array.isArray(e?.fields)
    ? e.fields.filter((f: any) => f && typeof f.field === 'string' && typeof f.message === 'string')
    : [];
  const message = (typeof e?.message === 'string' && e.message) || `API error: ${status}${statusText ? ` ${statusText}` : ''}`;
  return new ApiError(message, status, e?.code, fields, e?.details, e?.requestId);
}

/** Map of field name -> first message, for showing errors next to inputs. */
export function fieldErrorMap(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (err instanceof ApiError) for (const f of err.fields) if (!(f.field in out)) out[f.field] = f.message;
  return out;
}

/**
 * CORE MODEL: apiFetch (SOLID: DIP)
 * Standardized network requester that handles auth headers and error parsing.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${path}`, { 
    ...options,
    headers: { ...headers, ...options?.headers }
  });
  
  if (response.status === 401 && !path.includes('/auth/login')) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  const result = await response.json().catch(() => ({ _jsonParseFailed: true }));

  if (!response.ok) {
    throw parseApiError(response.status, response.statusText, result);
  }

  // Handle standard backend wrapping
  if (result.success && result.pagination) {
    return result as T;
  }

  return (result.success !== undefined ? result.data : result) as T;
}

export { API_BASE_URL };
