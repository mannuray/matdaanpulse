import { apiFetch, API_BASE_URL } from './api-client';
import { clearToken, setToken } from './auth.service';
import type { User } from '../types';

export async function getUsers() {
  return (await apiFetch<User[]>('/admin/users')) || [];
}

export function createUser(data: { email: string; password: string; name: string; role: string }) {
  return apiFetch<User>('/admin/users', { method: 'POST', body: JSON.stringify(data) });
}

/** PATCH /admin/users/:id — send only what changes; `password` only when a new one was typed. */
export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: User['role'];
  password?: string;
}

export function updateUser(id: string, data: UpdateUserData) {
  return apiFetch<User>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}


export function deleteUser(id: string) {
  return apiFetch<void>(`/admin/users/${id}`, { method: 'DELETE' });
}

export function login(email: string, password: string) {
  return apiFetch<{ access_token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Revokes the session server-side (POST /auth/logout bumps the user's token version, so this token and every
 * other copy stop working). Best effort: a plain fetch (not apiFetch, whose 401 handler redirects), errors ignored;
 * the caller clears the local session either way.
 */
export async function revokeSession(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true });
  } catch {
    // Offline or the API is down: the token still expires on its own (JWT_TTL, default 8 h).
  }
}

export { clearToken, setToken };
