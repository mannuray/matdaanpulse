// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';
import type { User } from '../types';

const svc = vi.hoisted(() => ({ getUsers: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn() }));
vi.mock('../services/user.service', () => svc);
import { DUPLICATE_EMAIL, EMPTY_USER, LAST_SUPER_ADMIN, panelError, useUserManager, userPatch, validateUser } from './useUserManager';
import { ApiError } from '../services/api-client';

const u = (id: string, name: string, email: string, role: User['role'] = 'EDITOR'): User => ({ id, name, email, role, created_at: '2026-10-01T05:00:00.000Z' });
const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

describe('user form rules', () => {
  it('validateUser: name and email required, email format, password length (required only on create)', () => {
    expect(validateUser(EMPTY_USER, true)).toEqual({ name: 'Name is required', email: 'Email is required', password: 'At least 8 characters' });
    expect(validateUser({ ...EMPTY_USER, name: 'A', email: 'not-an-email' }, false)).toEqual({ email: 'Enter a valid email address' });
    expect(validateUser({ ...EMPTY_USER, name: 'A', email: 'a@b.in' }, false)).toEqual({});
    expect(validateUser({ ...EMPTY_USER, name: 'A', email: 'a@b.in', password: 'short' }, false)).toEqual({ password: 'At least 8 characters' });
  });

  it('userPatch trims, omits an empty password, and leaves out the role on your own account', () => {
    const form = { name: ' Priya S ', email: ' priya@x.in ', role: 'VIEWER' as const, password: '' };
    expect(userPatch(form, false)).toEqual({ name: 'Priya S', email: 'priya@x.in', role: 'VIEWER' });
    expect('password' in userPatch(form, false)).toBe(false);
    expect(userPatch({ ...form, password: 'long-enough' }, true)).toEqual({ name: 'Priya S', email: 'priya@x.in', password: 'long-enough' });
  });

  it('panelError: 403 last super admin, 409 duplicate email, 400 fields; anything else is for a toast', () => {
    expect(panelError(new ApiError('Cannot delete the last SUPER_ADMIN', 403))).toEqual({ fields: {}, banner: LAST_SUPER_ADMIN });
    expect(panelError(new ApiError('A record with the same unique value already exists', 409))).toEqual({ fields: { email: DUPLICATE_EMAIL }, banner: null });
    expect(panelError(new ApiError('Validation failed', 400, 'V', [{ field: 'email', message: 'email must be an email' }]))).toEqual({ fields: { email: 'email must be an email' }, banner: null });
    expect(panelError(new ApiError('Internal server error', 500))).toBeNull();
    expect(panelError(new TypeError('Failed to fetch'))).toBeNull();
  });
});

describe('useUserManager', () => {
  it('loads once, filters in memory after typing pauses, and reports the 200 cap', async () => {
    svc.getUsers.mockResolvedValue([u('a', 'Priya S', 'priya@x.in'), u('b', 'Rahul M', 'rahul@x.in')]);
    const { result } = renderHook(() => useUserManager(), { wrapper });
    await waitFor(() => expect(result.current.visible).toHaveLength(2));
    act(() => result.current.setSearch('RAHUL'));
    expect(result.current.search).toBe('RAHUL');
    await waitFor(() => expect(result.current.visible.map((x) => x.id)).toEqual(['b']));
    expect(svc.getUsers).toHaveBeenCalledTimes(1);
    expect(result.current.capped).toBe(false);
    svc.getUsers.mockResolvedValueOnce(Array.from({ length: 200 }, (_, i) => u(`x${i}`, `User ${i}`, `u${i}@x.in`)));
    await act(async () => { await result.current.reload(); });
    expect(result.current.capped).toBe(true);
  });

  it('update merges the response into the list; a field error does not toast', async () => {
    svc.getUsers.mockResolvedValue([u('a', 'Priya S', 'priya@x.in')]);
    svc.updateUser.mockResolvedValueOnce({ id: 'a', name: 'Priya Singh', email: 'priya@x.in', role: 'EDITOR' });
    const { result } = renderHook(() => useUserManager(), { wrapper });
    await waitFor(() => expect(result.current.users).toHaveLength(1));
    let out: Awaited<ReturnType<typeof result.current.update>> | undefined;
    await act(async () => { out = await result.current.update('a', { name: 'Priya Singh' }); });
    expect(out).toEqual({ ok: true, value: { id: 'a', name: 'Priya Singh', email: 'priya@x.in', role: 'EDITOR' } });
    expect(result.current.users[0]).toEqual({ ...u('a', 'Priya Singh', 'priya@x.in') });
    svc.updateUser.mockRejectedValueOnce(new ApiError('dup', 409));
    await act(async () => { out = await result.current.update('a', { email: 'taken@x.in' }); });
    expect(out).toEqual({ ok: false, fields: { email: DUPLICATE_EMAIL }, banner: null });
    expect(document.body.textContent).not.toContain('Could not save user');
  });
});
