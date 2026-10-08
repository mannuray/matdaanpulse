// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from '../data/useApi';

describe('useApi isStale', () => {
  it('true while the data shown belongs to the previous inputs; false once this request answers (and on a plain refetch)', async () => {
    let release: (v: string) => void = () => {};
    const fetcher = (id: string) => (id === 'a' ? Promise.resolve('A') : new Promise<string>(r => { release = r; }));
    const { result, rerender } = renderHook(({ id }) => useApi(() => fetcher(id), [id]), { initialProps: { id: 'a' } });
    await waitFor(() => expect(result.current.data).toBe('A'));
    expect(result.current.isStale).toBe(false);
    rerender({ id: 'b' });
    expect(result.current.data).toBe('A');          // the previous data stays visible while loading
    expect(result.current.isStale).toBe(true);
    await act(async () => { release('B'); });
    await waitFor(() => expect(result.current.data).toBe('B'));
    expect(result.current.isStale).toBe(false);
  });
  it('no data yet: not stale', () => {
    const { result } = renderHook(() => useApi(() => new Promise(() => {}), ['x']));
    expect(result.current.isStale).toBe(false);
  });
});
