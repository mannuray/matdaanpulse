import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser, type UpdateUserData } from '../services/user.service';
import { useToast } from '../context/ToastContext';
import { ApiError, fieldErrorMap } from '../services/api-client';
import { describeError } from '../utils/api-error';
import { useDebouncedValue } from './useDebouncedValue';
import { SEARCH_DEBOUNCE_MS } from './useResourceList';
import type { User } from '../types';

export type UserRole = User['role'];
export interface UserForm { name: string; email: string; role: UserRole; password: string }
export type SaveOutcome<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string>; banner: string | null };

/** GET /admin/users returns at most this many (newest first). */
export const USER_LIST_CAP = 200;
export const MIN_PASSWORD = 8;
export const ROLE_OPTIONS: { value: UserRole; label: string; hint: string }[] = [
  { value: 'VIEWER', label: 'Viewer', hint: 'read only' },
  { value: 'EDITOR', label: 'Editor', hint: 'can update results' },
  { value: 'SUPER_ADMIN', label: 'Super admin', hint: 'full access' },
];
export const EMPTY_USER: UserForm = { name: '', email: '', role: 'VIEWER', password: '' };
export const LAST_SUPER_ADMIN = 'This is the last super admin. Make another user a super admin first.';
export const DUPLICATE_EMAIL = 'An account with this email already exists';

export const roleLabel = (role: UserRole) => ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
export const sameUserForm = (a: UserForm, b: UserForm) => a.name === b.name && a.email === b.email && a.role === b.role && a.password === b.password;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What the server would reject, checked first. A new user needs a password; an edit only checks one that was typed. */
export function validateUser(form: UserForm, requirePassword: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  const email = form.email.trim();
  if (!email) errors.email = 'Email is required';
  else if (!EMAIL.test(email)) errors.email = 'Enter a valid email address';
  if ((requirePassword || form.password) && form.password.length < MIN_PASSWORD) errors.password = `At least ${MIN_PASSWORD} characters`;
  return errors;
}

/**
 * Failures shown inside the panel instead of a toast: 403 (the last SUPER_ADMIN cannot be removed or demoted),
 * 409 (duplicate email; the backend sends no field list) and 400 field errors. null → the caller toasts.
 */
export function panelError(err: unknown): { fields: Record<string, string>; banner: string | null } | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status === 403) {
    return { fields: {}, banner: /last super_?admin/i.test(err.message) ? LAST_SUPER_ADMIN : 'You do not have permission to change this user.' };
  }
  if (err.status === 409) return { fields: { email: DUPLICATE_EMAIL }, banner: null };
  const fields = fieldErrorMap(err);
  return Object.keys(fields).length > 0 ? { fields, banner: null } : null;
}

/** PATCH body: trimmed name and email; the role unless it is your own account; the password only when typed. */
export function userPatch(form: UserForm, isSelf: boolean): UpdateUserData {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    ...(isSelf ? {} : { role: form.role }),
    ...(form.password ? { password: form.password } : {}),
  };
}

/**
 * CONTROLLER: Users. The list (max 200) is loaded once and filtered in memory on the debounced search.
 * Saves return a SaveOutcome so the panel can show field errors / the last-super-admin message inline.
 */
export function useUserManager() {
  const { toast, toastError } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(describeError(err, 'Could not load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
  }, [users, query]);

  const run = async <T>(action: () => Promise<T>, success: string, failure: string): Promise<SaveOutcome<T>> => {
    setSaving(true);
    try {
      const value = await action();
      toast(success);
      return { ok: true, value };
    } catch (err) {
      const shown = panelError(err);
      if (shown) return { ok: false, ...shown };
      toastError(err, failure);
      return { ok: false, fields: {}, banner: null };
    } finally {
      setSaving(false);
    }
  };

  const create = async (form: UserForm) => {
    const out = await run(
      () => createUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role }),
      'User created',
      'Could not create user',
    );
    if (out.ok) await reload();
    return out;
  };

  const update = async (id: string, data: UpdateUserData) => {
    const out = await run(() => updateUser(id, data), 'User updated', 'Could not save user');
    if (out.ok) setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...out.value } : u)));
    return out;
  };

  const remove = async (id: string) => {
    const out = await run(async () => { await deleteUser(id); return true as const; }, 'User deleted', 'Could not delete user');
    if (out.ok) setUsers((prev) => prev.filter((u) => u.id !== id));
    return out;
  };

  return { users, visible, loading, error, search, setSearch, saving, capped: users.length >= USER_LIST_CAP, reload, create, update, remove };
}
