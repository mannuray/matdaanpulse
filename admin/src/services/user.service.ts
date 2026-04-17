import { apiFetch } from './api-client';
import { clearToken, setToken } from './auth.service';
import type { User } from '../types';

export async function getUsers() {
  return (await apiFetch<User[]>('/admin/users')) || [];
}

export function createUser(data: { email: string; password: string; name: string; role: string }) {
  return apiFetch<User>('/admin/users', { method: 'POST', body: JSON.stringify(data) });
}

export function updateUser(id: string, data: Partial<User>) {
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

export { clearToken, setToken };
