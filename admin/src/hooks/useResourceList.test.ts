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

  it('debounces the search request; the input value and page reset are immediate', async () => {
    vi.useFakeTimers();
    try {
      const onLoad = vi.fn(async (_p: number, _s: string, _f: object) => ({ data: [] as unknown[], total: 0 }));
      const { result } = renderHook(() => useResourceList({ key: 'd1', initialFilters: {}, onLoad }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(onLoad).toHaveBeenCalledTimes(1);
      expect(onLoad).toHaveBeenLastCalledWith(1, '', {});
      act(() => result.current.handleSearch('p'));
      act(() => result.current.handleSearch('pa'));
      act(() => result.current.handleSearch('pat'));
      expect(result.current.search).toBe('pat');
      await act(async () => { await vi.advanceTimersByTimeAsync(299); });
      expect(onLoad).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(onLoad).toHaveBeenCalledTimes(2);
      expect(onLoad).toHaveBeenLastCalledWith(1, 'pat', {});
      expect(onLoad.mock.calls.some(([, s]) => s === 'p' || s === 'pa')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a slower response from an older request', async () => {
    let releaseFirst!: (v: { data: unknown[]; total: number }) => void;
    const onLoad = vi.fn((_p: number, s: string, _f: object) => (s === ''
      ? new Promise<{ data: unknown[]; total: number }>((r) => { releaseFirst = r; })
      : Promise.resolve({ data: [{ id: 'new' }] as unknown[], total: 1 })));
    const { result } = renderHook(() => useResourceList({ key: 's1', initialFilters: {}, onLoad }));
    act(() => result.current.handleSearch('x'));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'new' }]));
    await act(async () => { releaseFirst({ data: [{ id: 'old' }], total: 1 }); });
    expect(result.current.items).toEqual([{ id: 'new' }]);
    expect(result.current.loading).toBe(false);
  });

  it('steps back to the last page when the current page comes back empty', async () => {
    const onLoad = vi.fn(async (p: number) => (p === 1 ? { data: [{ id: 'a' }] as unknown[], total: 1 } : { data: [] as unknown[], total: 1 }));
    const { result } = renderHook(() => useResourceList({ key: 'c1', pageSize: 50, initialFilters: {}, onLoad }));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'a' }]));
    act(() => result.current.loadPage(2));
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(2, '', {}));
    await waitFor(() => expect(result.current.page).toBe(1));
    expect(result.current.items).toEqual([{ id: 'a' }]);
  });

  it('sanitizeFilters repairs filters restored from storage (merged over the defaults)', async () => {
    localStorage.setItem('f1_filters', JSON.stringify({ action: 'MANIFEST_PUBLISH' }));
    const onLoad = vi.fn(async (_p: number, _s: string, _f: { action: string; to: string }) => ({ data: [] as unknown[], total: 0 }));
    const { result } = renderHook(() => useResourceList({
      key: 'f1',
      initialFilters: { action: '', to: '' },
      sanitizeFilters: (f) => ({ ...f, action: f.action === 'RESULT_OVERRIDE' ? f.action : '' }),
      onLoad,
    }));
    expect(result.current.filters).toEqual({ action: '', to: '' });
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(1, '', { action: '', to: '' }));
  });

  it('starts in the loading state (the first request is already on its way)', () => {
    const onLoad = vi.fn(() => new Promise<{ data: unknown[]; total: number }>(() => {}));
    const { result } = renderHook(() => useResourceList({ key: 'l1', initialFilters: {}, onLoad }));
    expect(result.current.loading).toBe(true);
  });

  it('a corrupt stored filter falls back to the defaults', () => {
    localStorage.setItem('f2_filters', '{not json');
    const onLoad = vi.fn(async () => ({ data: [] as unknown[], total: 0 }));
    const { result } = renderHook(() => useResourceList({ key: 'f2', initialFilters: { status: '' }, onLoad }));
    expect(result.current.filters).toEqual({ status: '' });
  });
});
