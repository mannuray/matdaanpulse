// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/person.api', () => ({
  getPerson: vi.fn(async () => ({
    id: 'p1', name: 'Nitish Kumar', gender: 'M', education: null, photo_url: null, date_of_birth: null, bio: null, metadata: {}, candidates: [],
  })),
  updatePerson: vi.fn(async () => ({})),
  mergePersons: vi.fn(async () => ({ merged: true, target_id: 'p1' })),
  getPersons: vi.fn(async () => ({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } })),
}));
import { usePersonEdit } from './usePersonEdit';
import { mergePersons, updatePerson } from '../services/person.api';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

describe('usePersonEdit', () => {
  it('merging keeps the person being viewed: the duplicate is the source', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    await waitFor(() => expect(result.current.person?.id).toBe('p1'));
    await act(() => result.current.handleMerge('dup', 'Nitish Kr'));
    expect(mergePersons).toHaveBeenCalledWith('dup', 'p1');
  });

  it('a legacy "M" loads as Male, so saving another field keeps the gender', async () => {
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    await waitFor(() => expect(result.current.form.gender).toBe('Male'));
    act(() => result.current.setForm({ ...result.current.form, education: 'BA' }));
    await act(() => result.current.handleSave());
    expect(updatePerson).toHaveBeenCalledWith('p1', expect.objectContaining({ gender: 'Male', education: 'BA' }));
  });

  it('is clean after load, dirty after an edit, clean after reset; merge reports success', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.person).not.toBeNull());
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setForm({ ...result.current.form, bio: 'New bio' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
    let merged = false;
    await act(async () => { merged = await result.current.handleMerge('dup', 'Nitish Kr'); });
    expect(merged).toBe(true);
  });
});
