// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({ getParties: vi.fn() }));
vi.mock('../services/party.service', () => svc);
import { useParties } from './useParties';

afterEach(() => vi.clearAllMocks());

describe('useParties', () => {
  it('starts empty and fills with the full party list', async () => {
    svc.getParties.mockResolvedValue([{ id: 'BJP', name: 'Bharatiya Janata Party' }]);
    const { result } = renderHook(() => useParties());
    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current).toEqual([{ id: 'BJP', name: 'Bharatiya Janata Party' }]));
    expect(svc.getParties).toHaveBeenCalledTimes(1);
  });

  it('stays empty when the request fails', async () => {
    svc.getParties.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useParties());
    await waitFor(() => expect(svc.getParties).toHaveBeenCalled());
    await Promise.resolve();
    expect(result.current).toEqual([]);
  });

  it('ignores a response that arrives after unmount', async () => {
    let resolve!: (v: unknown) => void;
    svc.getParties.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useParties());
    unmount();
    resolve([{ id: 'X', name: 'X' }]);
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
