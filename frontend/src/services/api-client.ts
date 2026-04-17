const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3082/api/v1';

/**
 * CORE MODEL: apiFetch (SOLID: DIP)
 * Standardized network requester for the frontend.
 * Designed for consistency with the admin-side architecture.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  const result = await response.json().catch(() => ({ _jsonParseFailed: true }));

  if (!response.ok) {
    const errorMsg = result.error?.message || result.message || `API error: ${response.status} ${response.statusText}`;
    throw new Error(errorMsg);
  }

  // Handle standard backend wrapping (consistent with admin api-client)
  if (result.success && result.pagination) {
    return result as T;
  }
  return (result.success !== undefined ? result.data : result) as T;
}

export { API_BASE_URL };
