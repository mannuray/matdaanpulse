// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const ingest = vi.hoisted(() => ({ getHolds: vi.fn(), releaseHold: vi.fn(async () => undefined), correctSeat: vi.fn() }));
vi.mock('../services/ingest.service', () => ingest);
vi.mock('../services/election.service', () => ({ getSeatLocks: vi.fn(async () => []), getLiveResults: vi.fn(async () => []), subscribeLiveUpdates: vi.fn(() => () => {}) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ toast: vi.fn(), toastError: vi.fn() }) }));
import { useHolds, HOLDS_POLL_MS } from './live/useHolds';
import { useSeatSelection } from './live/useSeatSelection';
import { useSeatLocks } from './live/useSeatLocks';
import { SEAT_LOCK_TTL_MS } from '../utils/seat-math';

afterEach(() => vi.useRealTimers());
const hold = (const_id: string) => ({ const_id, const_no: 1, name: 'x', round_at_hold: null, expires_at: '2027-02-27T05:00:00Z', created_by_name: null });

describe('useHolds', () => {
  it('polls on its own interval, keeps the last list when a refresh fails, and resets for another election', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ingest.getHolds.mockResolvedValueOnce([hold('S1')]).mockRejectedValueOnce(new Error('down')).mockResolvedValue([]);
    const { result, rerender } = renderHook(({ id }) => useHolds(id), { initialProps: { id: 'e1' } });
    await waitFor(() => expect(result.current.holds.map(h => h.const_id)).toEqual(['S1']));
    await act(async () => { await vi.advanceTimersByTimeAsync(HOLDS_POLL_MS); });
    expect(ingest.getHolds).toHaveBeenCalledTimes(2);
    expect(result.current.holds.map(h => h.const_id)).toEqual(['S1']);
    rerender({ id: 'e2' });
    expect(result.current.holds).toEqual([]);
  });
});

describe('useSeatSelection', () => {
  const seat = (const_id: string, const_no: number, status: string) => ({ const_id, const_name: `Seat ${const_no}`, const_no, const_type: 'GEN', current_round: null, total_rounds: null,
    candidates: [{ result_id: 'r', candidate_id: 'c', candidate_name: 'n', party_id: 'P', party_name: 'P', party_color: null, party_abbr: 'P', votes: status === 'TRAILING' ? 0 : 5, status, margin: 0, last_updated: '' }] });
  const all = [seat('b', 2, 'LEADING'), seat('a', 1, 'TRAILING'), seat('c', 3, 'WON')] as any;
  it('sorts, filters, searches, keeps a valid selection and moves with the keys', () => {
    const { result } = renderHook(() => useSeatSelection(all, false));
    expect(result.current.seats.map(s => s.const_id)).toEqual(['a', 'b', 'c']);
    expect(result.current.selectedId).toBe('a');
    act(() => result.current.move(1));
    expect(result.current.selectedId).toBe('b');
    act(() => result.current.setFilter('WON'));
    expect(result.current.seats.map(s => s.const_id)).toEqual(['c']);
    expect(result.current.selectedId).toBe('c');
    act(() => { result.current.setFilter('all'); result.current.setSearch('seat 2'); });
    expect(result.current.seats.map(s => s.const_id)).toEqual(['b']);
  });
  it('holding the selection (unsaved edits) keeps a seat the filter hides', () => {
    const { result, rerender } = renderHook(({ hold }) => useSeatSelection(all, hold), { initialProps: { hold: false } });
    act(() => result.current.select('a'));
    rerender({ hold: true });
    act(() => result.current.setFilter('WON'));
    expect(result.current.selectedId).toBe('a');
  });
});

describe('useSeatLocks', () => {
  it('a lock older than the TTL is dropped on the next sweep; a lock event adds or removes one', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useSeatLocks('e1'));
    act(() => result.current.applyLockEvent('S1', { const_id: 'S1', user_id: 'u', user_name: 'A', acquired_at: new Date().toISOString() } as any));
    expect(Object.keys(result.current.locks)).toEqual(['S1']);
    await act(async () => { await vi.advanceTimersByTimeAsync(SEAT_LOCK_TTL_MS + 20_000); });
    expect(Object.keys(result.current.locks)).toEqual([]);
    act(() => result.current.applyLockEvent('S2', null));
    expect(result.current.locks).toEqual({});
  });
});
