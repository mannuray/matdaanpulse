import { useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../services/user.service';
import { useResourceList } from './useResourceList';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import type { User } from '../types';

/**
 * CONTROLLER: User Manager (MVC)
 * Handles user lifecycle, roles, and administrative access.
 */
export function useUserManager() {
  const { toast, toastError } = useToast();
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 1. List Logic
  const list = useResourceList<{}>({
    key: 'users',
    initialFilters: {},
    onLoad: async (_page, search) => {
      const all = await getUsers();
      const filtered = search
        ? all.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
        : all;
      return { data: filtered, total: filtered.length };
    }
  });

  // 2. Actions
  const handleSave = async (data: Partial<User> & { password?: string }, id?: string) => {
    setSaving(true);
    setFieldErrors({});
    try {
      if (id) {
        await updateUser(id, data);
        toast('User updated successfully');
      } else {
        await createUser(data as any);
        toast('User created successfully');
      }
      list.refresh();
      return true;
    } catch (err) {
      setFieldErrors(fieldErrorMap(err));
      toastError(err, 'Operation failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteUser(id);
      toast('User deleted');
      list.refresh();
    } catch (err) {
      toastError(err, 'Deletion failed');
    }
  };

  const handleUpdateRole = (id: string, role: string) => {
    return handleSave({ role: role as any }, id);
  };

  return {
    fieldErrors,
    ...list,
    saving,
    handleSave,
    handleCreate: handleSave,
    handleUpdateRole,
    handleDelete
  };
}
