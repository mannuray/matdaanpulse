import { useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../services/user.service';
import { useResourceList } from './useResourceList';
import { useToast } from '../context/ToastContext';
import type { User } from '../types';

/**
 * CONTROLLER: User Manager (MVC)
 * Handles user lifecycle, roles, and administrative access.
 */
export function useUserManager() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // 1. List Logic
  const list = useResourceList<{}>({
    key: 'users',
    initialFilters: {},
    onLoad: async (page, search) => {
      const all = await getUsers();
      const filtered = search
        ? all.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
        : all;
      return { data: filtered, total: filtered.length };
    }
  });

  // 2. Actions
  const handleSave = async (data: Partial<User>, id?: string) => {
    setSaving(true);
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
      toast('Operation failed', 'error');
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
    } catch {
      toast('Deletion failed', 'error');
    }
  };

  const handleUpdateRole = (id: string, role: string) => {
    return handleSave({ role: role as any }, id);
  };

  return {
    ...list,
    saving,
    handleSave,
    handleCreate: handleSave,
    handleUpdateRole,
    handleDelete
  };
}
