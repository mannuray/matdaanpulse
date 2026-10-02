// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/person.api', () => ({
  getPerson: vi.fn(async () => ({
    id: 'p1', name: 'Nitish Kumar', gender: 'M', education: null, photo_url: null, date_of_birth: null,
    bio: 'Old bio', wikipedia_url: null, caste: 'Kurmi', religion: null, candidates: [], merges: [],
  })),
  updatePerson: vi.fn(async () => ({})),
  mergePersons: vi.fn(async () => ({ merged: true, target_id: 'p1', merge_id: 'm1' })),
  undoMerge: vi.fn(async () => ({ undone: true, merge_id: 'm1', person_id: 'dup', keeper_id: 'p1' })),
  getPersons: vi.fn(async () => ({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } })),
}));
import { usePersonEdit } from './usePersonEdit';
import { getPerson, mergePersons, undoMerge, updatePerson } from '../services/person.api';
import { ApiError } from '../services/api-client';

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

  it('saves the identity fields as top-level columns and never sends metadata', async () => {
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    await waitFor(() => expect(result.current.form.gender).toBe('Male'));
    expect(result.current.form).toMatchObject({ bio: 'Old bio', wikipedia_url: '', caste: 'Kurmi', religion: '' });
    act(() => result.current.setForm({ ...result.current.form, education: 'BA', religion: 'Hindu', caste: '' }));
    await act(() => result.current.handleSave());
    const [, body] = vi.mocked(updatePerson).mock.calls[0];
    expect(body).toEqual({
      name: 'Nitish Kumar', date_of_birth: null, gender: 'Male', education: 'BA', photo_url: null,
      bio: 'Old bio', wikipedia_url: null, caste: null, religion: 'Hindu',
    });
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

  it('undo reloads the person and reports it is still there', async () => {
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    await waitFor(() => expect(result.current.person).not.toBeNull());
    let out: Awaited<ReturnType<typeof result.current.handleUndo>> = null;
    await act(async () => { out = await result.current.handleUndo('m1'); });
    expect(undoMerge).toHaveBeenCalledWith('m1');
    expect(out).toEqual({ restoredId: 'dup', keeperGone: false });
    expect(getPerson).toHaveBeenCalledTimes(2);
  });

  it('undo of a merge into a person with no contests of its own says the keeper is gone (it was deleted)', async () => {
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    await waitFor(() => expect(result.current.person).not.toBeNull());
    vi.mocked(getPerson).mockRejectedValueOnce(new ApiError('Person not found', 404));
    let out: Awaited<ReturnType<typeof result.current.handleUndo>> = null;
    await act(async () => { out = await result.current.handleUndo('m1'); });
    expect(out).toEqual({ restoredId: 'dup', keeperGone: true });
  });

  it('a refused undo (409) returns null and keeps the record', async () => {
    vi.mocked(undoMerge).mockRejectedValueOnce(new ApiError("Can't undo this merge: Ravi Prasad no longer belongs to this person.", 409));
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    await waitFor(() => expect(result.current.person).not.toBeNull());
    let out: Awaited<ReturnType<typeof result.current.handleUndo>> = { restoredId: 'x', keeperGone: false };
    await act(async () => { out = await result.current.handleUndo('m1'); });
    expect(out).toBeNull();
    expect(result.current.person?.id).toBe('p1');
  });
});
