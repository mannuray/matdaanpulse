// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../services/api-client';

const acquire = vi.fn();
const release = vi.fn(async (..._a: unknown[]) => {});
vi.mock('../services/election.service', () => ({
  acquireSeatLock: (...a: unknown[]) => acquire(...a),
  releaseSeatLock: (...a: unknown[]) => release(...a),
}));
import { useSeatLock, LOCK_HEARTBEAT_MS, LOCK_ACQUIRE_DEBOUNCE_MS } from './useSeatLock';

const lock = (user_id: string, const_id = 'c1') => ({ const_id, user_id, user_name: user_id, acquired_at: 't' });

// shouldAdvanceTime: fake clock follows real time, so waitFor() also lets the acquire debounce elapse.
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); acquire.mockReset(); release.mockClear(); });
afterEach(() => vi.useRealTimers());

describe('useSeatLock', () => {
  it('debounces acquire, heartbeats, and releases the old seat on switch', async () => {
    acquire.mockImplementation(async (_e, c) => lock('me', c));
    const { result, rerender } = renderHook(({ c }) => useSeatLock('e1', c, 'me', undefined), { initialProps: { c: 'c1' as string | null } });
    expect(acquire).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.state).toBe('held'));
    await act(async () => { vi.advanceTimersByTime(LOCK_HEARTBEAT_MS); });
    expect(acquire).toHaveBeenCalledTimes(2);
    rerender({ c: 'c2' });
    await waitFor(() => expect(release).toHaveBeenCalledWith('e1', 'c1', undefined));
  });

  it('skipping quickly past seats only locks the one you stop on', async () => {
    acquire.mockImplementation(async (_e, c) => lock('me', c));
    const { rerender } = renderHook(({ c }) => useSeatLock('e1', c, 'me', undefined), { initialProps: { c: 'c1' as string | null } });
    rerender({ c: 'c2' });
    rerender({ c: 'c3' });
    await act(async () => { vi.advanceTimersByTime(LOCK_ACQUIRE_DEBOUNCE_MS + 10); });
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(1));
    expect(acquire).toHaveBeenCalledWith('e1', 'c3', false);
  });

  it('a late acquire for a seat you already left is released, not kept', async () => {
    let resolveC1: (v: unknown) => void = () => {};
    acquire.mockImplementationOnce(() => new Promise((r) => { resolveC1 = r; }));
    acquire.mockImplementation(async (_e, c) => lock('me', c));
    const { result, rerender } = renderHook(({ c }) => useSeatLock('e1', c, 'me', undefined), { initialProps: { c: 'c1' as string | null } });
    await act(async () => { vi.advanceTimersByTime(LOCK_ACQUIRE_DEBOUNCE_MS + 10); });
    expect(acquire).toHaveBeenCalledWith('e1', 'c1', false);
    rerender({ c: 'c2' });
    await act(async () => { resolveC1(lock('me', 'c1')); });
    expect(release).toHaveBeenCalledWith('e1', 'c1', undefined);
    await waitFor(() => expect(result.current.holder?.const_id).toBe('c2'));
  });

  it('409 → locked with the holder; takeOver acquires with take_over', async () => {
    acquire.mockRejectedValueOnce(new ApiError('locked', 409, 'RESULT_6002', [], { lock: lock('priya') }));
    const { result } = renderHook(() => useSeatLock('e1', 'c1', 'me', undefined));
    await waitFor(() => expect(result.current.state).toBe('locked'));
    expect(result.current.holder?.user_id).toBe('priya');
    acquire.mockResolvedValueOnce(lock('me'));
    await act(() => result.current.takeOver());
    expect(acquire).toHaveBeenLastCalledWith('e1', 'c1', true);
    expect(result.current.state).toBe('held');
  });

  it('503 → unavailable (saving still allowed by the caller)', async () => {
    acquire.mockRejectedValueOnce(new ApiError('down', 503, 'RESULT_6003'));
    const { result } = renderHook(() => useSeatLock('e1', 'c1', 'me', undefined));
    await waitFor(() => expect(result.current.state).toBe('unavailable'));
  });

  it('a remote lock by someone else while held → locked (taken over)', async () => {
    acquire.mockResolvedValue(lock('me'));
    const { result, rerender } = renderHook(({ r }) => useSeatLock('e1', 'c1', 'me', r), { initialProps: { r: undefined as ReturnType<typeof lock> | undefined } });
    await waitFor(() => expect(result.current.state).toBe('held'));
    rerender({ r: lock('priya') });
    expect(result.current.state).toBe('locked');
    expect(result.current.holder?.user_id).toBe('priya');
  });

  it('pagehide sends a keepalive release', async () => {
    acquire.mockResolvedValue(lock('me'));
    const { result } = renderHook(() => useSeatLock('e1', 'c1', 'me', undefined));
    await waitFor(() => expect(result.current.state).toBe('held'));
    window.dispatchEvent(new Event('pagehide'));
    expect(release).toHaveBeenCalledWith('e1', 'c1', { keepalive: true });
  });

  it('unmounting while an acquire is pending releases the lock when it resolves', async () => {
    let resolveAcq: (v: unknown) => void = () => {};
    acquire.mockImplementationOnce(() => new Promise((r) => { resolveAcq = r; }));
    const { unmount } = renderHook(() => useSeatLock('e1', 'c1', 'me', undefined));
    await act(async () => { vi.advanceTimersByTime(LOCK_ACQUIRE_DEBOUNCE_MS + 10); });
    expect(acquire).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { resolveAcq(lock('me', 'c1')); });
    expect(release).toHaveBeenCalledWith('e1', 'c1', undefined);
  });

  it('a stale remote lock (previous holder) does not undo a successful take-over', async () => {
    const t = (s: string) => `2026-10-01T10:00:${s}Z`;
    const priya = (s: string) => ({ ...lock('priya'), acquired_at: t(s) });
    acquire.mockRejectedValueOnce(new ApiError('locked', 409, 'RESULT_6002', [], { lock: priya('00') }));
    const { result, rerender } = renderHook(({ r }) => useSeatLock('e1', 'c1', 'me', r), { initialProps: { r: priya('00') as ReturnType<typeof lock> | undefined } });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    acquire.mockResolvedValueOnce({ ...lock('me'), acquired_at: t('01') });
    await act(() => result.current.takeOver());
    expect(result.current.state).toBe('held');
    rerender({ r: priya('00') });
    expect(result.current.state).toBe('held');
    rerender({ r: priya('02') });
    expect(result.current.state).toBe('locked');
  });

  it('a failed heartbeat (503) keeps ownership, so a later switch still releases', async () => {
    acquire.mockResolvedValueOnce(lock('me'));
    const { result, rerender } = renderHook(({ c }) => useSeatLock('e1', c, 'me', undefined), { initialProps: { c: 'c1' as string | null } });
    await waitFor(() => expect(result.current.state).toBe('held'));
    acquire.mockRejectedValueOnce(new ApiError('down', 503, 'RESULT_6003'));
    await act(async () => { vi.advanceTimersByTime(LOCK_HEARTBEAT_MS); });
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('held');
    acquire.mockResolvedValue(lock('me', 'c2'));
    rerender({ c: 'c2' });
    await waitFor(() => expect(release).toHaveBeenCalledWith('e1', 'c1', undefined));
  });

  it('locked → the holder releases (remote lock gone) → acquires normally and becomes held', async () => {
    acquire.mockRejectedValueOnce(new ApiError('locked', 409, 'RESULT_6002', [], { lock: lock('priya') }));
    const { result, rerender } = renderHook(({ r }) => useSeatLock('e1', 'c1', 'me', r), { initialProps: { r: lock('priya') as ReturnType<typeof lock> | null } });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    expect(acquire).toHaveBeenCalledTimes(1);
    acquire.mockResolvedValueOnce(lock('me'));
    rerender({ r: null });
    await waitFor(() => expect(result.current.state).toBe('held'));
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(acquire).toHaveBeenLastCalledWith('e1', 'c1', false);
  });

  it('while locked, retries a normal acquire every heartbeat (holder TTL lapsed with no event)', async () => {
    acquire.mockRejectedValueOnce(new ApiError('locked', 409, 'RESULT_6002', [], { lock: lock('priya') }));
    const { result } = renderHook(() => useSeatLock('e1', 'c1', 'me', undefined));
    await waitFor(() => expect(result.current.state).toBe('locked'));
    acquire.mockRejectedValueOnce(new ApiError('down', 503, 'RESULT_6003'));
    await act(async () => { vi.advanceTimersByTime(LOCK_HEARTBEAT_MS); });
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(acquire).toHaveBeenLastCalledWith('e1', 'c1', false);
    expect(result.current.state).toBe('locked'); // a transient failure does not unlock someone else's seat
    acquire.mockResolvedValueOnce(lock('me'));
    await act(async () => { vi.advanceTimersByTime(LOCK_HEARTBEAT_MS); });
    await waitFor(() => expect(result.current.state).toBe('held'));
    expect(acquire).toHaveBeenCalledTimes(3);
  });
});
