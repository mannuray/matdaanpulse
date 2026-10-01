// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useResourceList } from './useResourceList';

afterEach(() => localStorage.clear());

describe('useResourceList', () => {
  it('loadPage moves to that page and loads it', async () => {
    const onLoad = vi.fn(async (p: number) => ({ data: [{ id: `p${p}` }], total: 60 }));
    const { result } = renderHook(() => useResourceList({ key: 't1', pageSize: 25, initialFilters: {}, onLoad }));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p1' }]));
    act(() => result.current.loadPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p2' }]));
    expect(result.current.totalPages).toBe(3);
  });

  it('a new search goes back to page 1', async () => {
    const onLoad = vi.fn(async () => ({ data: [], total: 60 }));
    const { result } = renderHook(() => useResourceList({ key: 't2', initialFilters: {}, onLoad }));
    act(() => result.current.loadPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));
    act(() => result.current.handleSearch('pat'));
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(onLoad).toHaveBeenLastCalledWith(1, 'pat', {}));
  });

  it('initialSearch wins over the remembered search and is sent to onLoad', async () => {
    localStorage.setItem('t3_search', 'old');
    const onLoad = vi.fn(async () => ({ data: [], total: 0 }));
    const { result } = renderHook(() => useResourceList({ key: 't3', initialFilters: {}, initialSearch: 'Nitish', onLoad }));
    expect(result.current.search).toBe('Nitish');
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(1, 'Nitish', {}));
  });

  it('without initialSearch it falls back to the remembered search', () => {
    localStorage.setItem('t4_search', 'old');
    const onLoad = vi.fn(async () => ({ data: [], total: 0 }));
    const { result } = renderHook(() => useResourceList({ key: 't4', initialFilters: {}, initialSearch: null, onLoad }));
    expect(result.current.search).toBe('old');
  });
});
