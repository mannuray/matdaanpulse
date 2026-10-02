// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../services/api-client';
import { useRecordQuery } from './useRecordQuery';

describe('useRecordQuery', () => {
  it('loads, and retry after a failure loads again', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new ApiError('boom', 500)).mockResolvedValue({ ok: 1 });
    const { result } = renderHook(() => useRecordQuery(fn, 'a'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.error).toBe('failed'));
    expect(result.current.failed).toBe(true);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toEqual({ ok: 1 }));
    expect(result.current.failed).toBe(false);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('a 404 is not_found', async () => {
    const { result } = renderHook(() => useRecordQuery(() => Promise.reject(new ApiError('nope', 404)), 'a'));
    await waitFor(() => expect(result.current.error).toBe('not_found'));
  });

  it('a 400 (the id itself was rejected) is not_found; a 500 is failed', async () => {
    const bad = renderHook(() => useRecordQuery(() => Promise.reject(new ApiError('bad id', 400)), 'abc'));
    await waitFor(() => expect(bad.result.current.error).toBe('not_found'));
    const down = renderHook(() => useRecordQuery(() => Promise.reject(new ApiError('boom', 500)), 'a'));
    await waitFor(() => expect(down.result.current.error).toBe('failed'));
  });

  it('drops a late response for the previous id', async () => {
    let releaseA!: (v: string) => void;
    const fn = vi.fn((id: string) => (id === 'a' ? new Promise<string>((r) => { releaseA = r; }) : Promise.resolve('B')));
    const { result, rerender } = renderHook(({ id }) => useRecordQuery(fn, id), { initialProps: { id: 'a' } });
    rerender({ id: 'b' });
    await waitFor(() => expect(result.current.data).toBe('B'));
    await act(async () => { releaseA('A'); });
    expect(result.current.data).toBe('B');
  });

  it('does nothing without an id', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useRecordQuery(fn, null));
    expect(result.current.loading).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
