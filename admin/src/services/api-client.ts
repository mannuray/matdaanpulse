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
    const errorMsg = result.error?.message || result.message || `API error: ${response.status}`;
    throw new Error(errorMsg);
  }

  // Handle standard backend wrapping
  if (result.success && result.pagination) {
    return result as T;
  }

  return (result.success !== undefined ? result.data : result) as T;
}

export { API_BASE_URL };
