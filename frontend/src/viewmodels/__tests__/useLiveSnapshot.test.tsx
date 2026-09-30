// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const getLiveState = vi.fn();
const getResultsSnapshot = vi.fn();
vi.mock('../../model/api/election.service', () => ({
  getLiveState: (...a: unknown[]) => getLiveState(...a),
  getResultsSnapshot: (...a: unknown[]) => getResultsSnapshot(...a),
}));

import { useLiveSnapshot, LIVE_FAILURES_BEFORE_ERROR } from '../data/useLiveSnapshot';

const live = (version: number, status = 'Live') => ({ version, status, updatedAt: '', declared: 0, total: 1 });
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
  getLiveState.mockReset();
  getResultsSnapshot.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useLiveSnapshot', () => {
  it('delivers the snapshot and the latest status', async () => {
    getLiveState.mockResolvedValue(live(3));
    getResultsSnapshot.mockResolvedValue({ version: 3, results: [], summary: [], voteShare: [] });
    const { result, unmount } = renderHook(() => useLiveSnapshot('e1', true));
    await flush();
    expect(result.current.snapshot?.version).toBe(3);
    expect(result.current.status).toBe('Live');
    expect(result.current.connected).toBe(true);
    unmount();
  });

  it(`repeated failures before any snapshot surface an error (after ${LIVE_FAILURES_BEFORE_ERROR}); Retry polls now and recovers`, async () => {
    getLiveState.mockRejectedValue(new Error('backend down'));
    const { result, unmount } = renderHook(() => useLiveSnapshot('e1', true));
    await flush();
    expect(result.current.error).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(getLiveState.mock.calls.length).toBeGreaterThanOrEqual(LIVE_FAILURES_BEFORE_ERROR);
    expect(result.current.error).toBe('backend down');

    getLiveState.mockResolvedValue(live(1));
    getResultsSnapshot.mockResolvedValue({ version: 1, results: [], summary: [], voteShare: [] });
    const before = getLiveState.mock.calls.length;
    act(() => result.current.pollNow());
    await flush();
    expect(getLiveState.mock.calls.length).toBe(before + 1);
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot?.version).toBe(1);
    unmount();
  });

  it('after a manual Retry the next failure shows the error at once', async () => {
    getLiveState.mockRejectedValue(new Error('down'));
    const { result, unmount } = renderHook(() => useLiveSnapshot('e1', true));
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(result.current.error).toBe('down');
    act(() => result.current.pollNow());
    expect(result.current.error).toBeNull();
    await flush();
    expect(result.current.error).toBe('down');
    unmount();
  });

  it('disabled: fetches nothing', async () => {
    const { result } = renderHook(() => useLiveSnapshot('e1', false));
    await flush();
    expect(getLiveState).not.toHaveBeenCalled();
    expect(result.current.snapshot).toBeNull();
  });
});
