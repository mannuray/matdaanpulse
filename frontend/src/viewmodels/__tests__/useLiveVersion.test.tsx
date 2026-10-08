// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const getLiveState = vi.fn();
const getResultsSnapshot = vi.fn();
vi.mock('../../model/api/election.service', () => ({
  getLiveState: (...a: unknown[]) => getLiveState(...a),
  getResultsSnapshot: (...a: unknown[]) => getResultsSnapshot(...a),
}));

import { useLiveVersion } from '../data/useLiveVersion';
import { POLL } from '../../model/live/poller';

const live = (version: number, status = 'Live') => ({ version, status, updatedAt: '', declared: 0, total: 1 });
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
  getLiveState.mockReset();
  getResultsSnapshot.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useLiveVersion (the small /live document only)', () => {
  it('reports the version and status from /live and never loads the results snapshot', async () => {
    getLiveState.mockResolvedValue(live(3));
    const { result, unmount } = renderHook(() => useLiveVersion('e1', true));
    await flush();
    expect(result.current).toEqual({ version: 3, status: 'Live' });
    getLiveState.mockResolvedValue(live(4));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL.intervalMs + POLL.intervalJitterMs + POLL.snapshotJitterMs); });
    expect(result.current.version).toBe(4);
    expect(getResultsSnapshot).not.toHaveBeenCalled();
    unmount();
  });

  it('before counting: the status is followed, no version yet', async () => {
    getLiveState.mockResolvedValue(live(0, 'Upcoming'));
    const { result, unmount } = renderHook(() => useLiveVersion('e1', true));
    await flush();
    expect(result.current).toEqual({ version: null, status: 'Upcoming' });
    unmount();
  });

  it('disabled: nothing is fetched', async () => {
    const { result } = renderHook(() => useLiveVersion('e1', false));
    await flush();
    expect(getLiveState).not.toHaveBeenCalled();
    expect(result.current).toEqual({ version: null, status: null });
  });
});
