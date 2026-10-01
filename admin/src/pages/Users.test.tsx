// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { User } from '../types';

const svc = vi.hoisted(() => ({ getUsers: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn() }));
vi.mock('../services/user.service', () => svc);
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', name: 'Mannu K', email: 'mannu@x.in', role: 'SUPER_ADMIN' }, hasRole: (...r: string[]) => r.includes('SUPER_ADMIN') }),
}));
import Users from './Users';
import { renderEntityPage } from '../test-utils/entity-harness';
import { ApiError } from '../services/api-client';
import { DUPLICATE_EMAIL, LAST_SUPER_ADMIN } from '../hooks/useUserManager';

const u = (id: string, name: string, email: string, role: User['role']): User => ({ id, name, email, role, created_at: '2026-10-01T05:00:00.000Z' });
let USERS: User[] = [];

beforeEach(() => {
  USERS = [
    u('me', 'Mannu K', 'mannu@x.in', 'SUPER_ADMIN'),
    u('u2', 'Priya S', 'priya@x.in', 'EDITOR'),
    u('u3', 'Rahul M', 'rahul@x.in', 'VIEWER'),
    u('u4', 'Asha T', 'asha@x.in', 'SUPER_ADMIN'),
  ];
  svc.getUsers.mockImplementation(async () => USERS);
  svc.updateUser.mockImplementation(async (id: string, data: Partial<User>) => ({ ...USERS.find((x) => x.id === id)!, ...data }));
  svc.deleteUser.mockImplementation(async () => undefined);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/users') => renderEntityPage('/users', <Users />, at);
const table = () => screen.getByRole('table', { name: 'Users' });
const rowOf = (name: string) => within(table()).getByText(name).closest('tr')!;
const where = () => screen.getByTestId('where').textContent;

describe('Users page', () => {
  it('lists users with sentence-case role badges and marks your own row', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    expect(within(rowOf('Mannu K')).getByText('You')).toBeTruthy();
    expect(within(rowOf('Mannu K')).getByText('Super admin')).toBeTruthy();
    expect(within(rowOf('Priya S')).getByText('Editor')).toBeTruthy();
    expect(within(rowOf('Rahul M')).getByText('Viewer')).toBeTruthy();
    expect(within(rowOf('Rahul M')).getByText('1 Oct 2026')).toBeTruthy();
    expect(within(rowOf('Rahul M')).queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Showing first 200')).toBeNull();
  });

  it('search filters by name or email once typing pauses, without refetching', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'rahul@' } });
    await waitFor(() => expect(within(table()).queryByText('Priya S')).toBeNull());
    expect(within(table()).getByText('Rahul M')).toBeTruthy();
    expect(svc.getUsers).toHaveBeenCalledTimes(1);
  });

  it('says "Showing first 200" when the backend cap is reached', async () => {
    USERS = Array.from({ length: 200 }, (_, i) => u(`x${i}`, `User ${i}`, `u${i}@x.in`, 'VIEWER'));
    renderAt();
    expect(await screen.findByText('Showing first 200')).toBeTruthy();
  });

  it('your own account: role and delete are disabled with hints; saving sends no role (Review Focus 2)', async () => {
    renderAt('/users/me');
    const panel = await screen.findByRole('dialog', { name: 'Mannu K' });
    expect((await within(panel).findByLabelText('Role') as HTMLSelectElement).disabled).toBe(true);
    expect(within(panel).getByText('You cannot change your own role.')).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Delete user' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).getByText('You cannot delete your own account.')).toBeTruthy();
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Mannu Kumar' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateUser).toHaveBeenCalledWith('me', { name: 'Mannu Kumar', email: 'mannu@x.in' }));
  });

  it('edits another user through Save; an empty new password is not sent; a short one is refused first', async () => {
    renderAt('/users/u2');
    const panel = await screen.findByRole('dialog', { name: 'Priya S' });
    fireEvent.change(await within(panel).findByLabelText('Role'), { target: { value: 'VIEWER' } });
    expect(svc.updateUser).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateUser).toHaveBeenCalledWith('u2', { name: 'Priya S', email: 'priya@x.in', role: 'VIEWER' }));
    expect(await screen.findByText('User updated')).toBeTruthy();
    await waitFor(() => expect(within(rowOf('Priya S')).getByText('Viewer')).toBeTruthy());
    fireEvent.change(within(panel).getByLabelText('Set new password'), { target: { value: 'short' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(within(panel).getByText('At least 8 characters')).toBeTruthy();
    expect(svc.updateUser).toHaveBeenCalledTimes(1);
  });

  it('a 403 on demoting the last super admin shows inline and keeps the form', async () => {
    svc.updateUser.mockRejectedValueOnce(new ApiError('Cannot demote the last SUPER_ADMIN', 403));
    renderAt('/users/u4');
    const panel = await screen.findByRole('dialog', { name: 'Asha T' });
    fireEvent.change(await within(panel).findByLabelText('Role'), { target: { value: 'EDITOR' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect((await within(panel).findByRole('alert')).textContent).toBe(LAST_SUPER_ADMIN);
    expect((within(panel).getByLabelText('Role') as HTMLSelectElement).value).toBe('EDITOR');
    expect(screen.queryByText('User updated')).toBeNull();
  });

  it('deleting asks once in a dialog (never window.confirm) and removes the user', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    renderAt('/users/u3');
    const panel = await screen.findByRole('dialog', { name: 'Rahul M' });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Delete user' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Rahul M?' })).getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(svc.deleteUser).toHaveBeenCalledWith('u3'));
    await waitFor(() => expect(where()).toBe('/users'));
    expect(within(table()).queryByText('Rahul M')).toBeNull();
    expect(await screen.findByText('User deleted')).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('the last super admin: a 403 on delete shows inline, the user stays, no success toast', async () => {
    svc.deleteUser.mockRejectedValueOnce(new ApiError('Cannot delete the last SUPER_ADMIN', 403));
    renderAt('/users/u4');
    const panel = await screen.findByRole('dialog', { name: 'Asha T' });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Delete user' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect((await within(panel).findByRole('alert')).textContent).toBe(LAST_SUPER_ADMIN);
    expect(where()).toBe('/users/u4');
    expect(within(table()).getByText('Asha T')).toBeTruthy();
    expect(screen.queryByText('User deleted')).toBeNull();
  });

  it('create: checks fields first; a duplicate email (409) shows under Email with no toast', async () => {
    svc.createUser.mockRejectedValueOnce(new ApiError('A record with the same unique value already exists', 409));
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'New user' }));
    expect(where()).toBe('/users/new');
    const panel = screen.getByRole('dialog', { name: 'New user' });
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Sunita Y' } });
    fireEvent.change(within(panel).getByLabelText('Email'), { target: { value: 'priya@x.in' } });
    fireEvent.change(within(panel).getByLabelText('Temporary password'), { target: { value: 'short' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create user' }));
    expect(within(panel).getByText('At least 8 characters')).toBeTruthy();
    expect(svc.createUser).not.toHaveBeenCalled();
    fireEvent.change(within(panel).getByLabelText('Temporary password'), { target: { value: 'long-enough-1' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create user' }));
    expect(await within(panel).findByText(DUPLICATE_EMAIL)).toBeTruthy();
    expect(svc.createUser).toHaveBeenCalledWith({ name: 'Sunita Y', email: 'priya@x.in', password: 'long-enough-1', role: 'VIEWER' });
    expect(screen.queryByText(/Could not create user/)).toBeNull();
  });

  it('a successful create opens the new user', async () => {
    svc.createUser.mockImplementationOnce(async (d: { name: string; email: string; role: User['role'] }) => {
      const created = u('u9', d.name, d.email, d.role);
      USERS = [created, ...USERS];
      return created;
    });
    renderAt('/users/new');
    const panel = screen.getByRole('dialog', { name: 'New user' });
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Sunita Y' } });
    fireEvent.change(within(panel).getByLabelText('Email'), { target: { value: 'sunita@x.in' } });
    fireEvent.change(within(panel).getByLabelText('Temporary password'), { target: { value: 'long-enough-1' } });
    fireEvent.change(within(panel).getByLabelText('Role'), { target: { value: 'EDITOR' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create user' }));
    await waitFor(() => expect(where()).toBe('/users/u9'));
    expect(await screen.findByRole('dialog', { name: 'Sunita Y' })).toBeTruthy();
    expect(await screen.findByText('User created')).toBeTruthy();
  });

  it('a failed list shows Could not load users with Try again', async () => {
    svc.getUsers.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    renderAt();
    expect(await screen.findByText('Could not load users')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await within(table()).findByText('Priya S')).toBeTruthy();
  });
});
