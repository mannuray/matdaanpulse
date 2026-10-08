// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const api = vi.hoisted(() => ({ getPersons: vi.fn() }));
vi.mock('../services/person.api', () => api);
import { usePersonSearch } from './usePersonSearch';

const P = (id: string) => ({ id, name: `Person ${id}` });
const page = (ids: string[]) => ({ success: true, data: ids.map(P), pagination: { page: 1, limit: 10, total: ids.length, totalPages: 1 } });

beforeEach(() => { vi.useFakeTimers(); api.getPersons.mockResolvedValue(page(['a', 'b'])); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

describe('usePersonSearch', () => {
  it('searches 400 ms after typing stops, with the trimmed query and limit', async () => {
    const { result, rerender } = renderHook(({ q }) => usePersonSearch(q, { limit: 20 }), { initialProps: { q: '' } });
    rerender({ q: ' ra' });
    rerender({ q: ' ram ' });
    act(() => { vi.advanceTimersByTime(399); });
    expect(api.getPersons).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    await flush();
    expect(api.getPersons).toHaveBeenCalledTimes(1);
    expect(api.getPersons).toHaveBeenCalledWith(1, 20, 'ram');
    expect(result.current.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('leaves out the excluded person', async () => {
    const { result, rerender } = renderHook(({ q }) => usePersonSearch(q, { excludeId: 'a' }), { initialProps: { q: '' } });
    rerender({ q: 'ram' });
    act(() => { vi.advanceTimersByTime(400); });
    await flush();
    expect(api.getPersons).toHaveBeenCalledWith(1, 10, 'ram');
    expect(result.current.map((p) => p.id)).toEqual(['b']);
  });

  it('clears at once when the query drops under 2 characters, without a request', async () => {
    const { result, rerender } = renderHook(({ q }) => usePersonSearch(q), { initialProps: { q: '' } });
    rerender({ q: 'ram' });
    act(() => { vi.advanceTimersByTime(400); });
    await flush();
    expect(result.current).toHaveLength(2);
    rerender({ q: '' });
    expect(result.current).toEqual([]);
    rerender({ q: 'r' });
    act(() => { vi.advanceTimersByTime(400); });
    await flush();
    expect(api.getPersons).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual([]);
  });

  it('a slow earlier response does not overwrite a newer one', async () => {
    let releaseOld!: (v: unknown) => void;
    api.getPersons.mockImplementationOnce(() => new Promise((r) => { releaseOld = r; }));
    api.getPersons.mockResolvedValueOnce(page(['new']));
    const { result, rerender } = renderHook(({ q }) => usePersonSearch(q), { initialProps: { q: '' } });
    rerender({ q: 'old' });
    act(() => { vi.advanceTimersByTime(400); });
    rerender({ q: 'newer' });
    act(() => { vi.advanceTimersByTime(400); });
    await flush();
    expect(result.current.map((p) => p.id)).toEqual(['new']);
    await act(async () => { releaseOld(page(['old'])); await Promise.resolve(); });
    expect(result.current.map((p) => p.id)).toEqual(['new']);
  });

  it('a failed search shows nothing', async () => {
    api.getPersons.mockRejectedValueOnce(new Error('down'));
    const { result, rerender } = renderHook(({ q }) => usePersonSearch(q), { initialProps: { q: '' } });
    rerender({ q: 'ram' });
    act(() => { vi.advanceTimersByTime(400); });
    await flush();
    expect(result.current).toEqual([]);
  });
});
