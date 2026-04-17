export function getToken(): string | null {
  return localStorage.getItem('admin_token');
}

export function setToken(token: string) {
  localStorage.setItem('admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
}

/**
 * Handles 401 Unauthorized errors by clearing the token
 * and optionally redirecting to the login page.
 */
export function handleUnauthorized() {
  clearToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
