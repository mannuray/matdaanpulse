// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVisiblePoll } from './useVisiblePoll';

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => { setHidden(false); vi.useRealTimers(); });

describe('useVisiblePoll', () => {
  it('ticks every interval while visible, pauses while hidden, and ticks once on return', () => {
    const tick = vi.fn();
    renderHook(() => useVisiblePoll(tick, 30_000));
    expect(tick).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(tick).toHaveBeenCalledTimes(1);
    act(() => setHidden(true));
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(tick).toHaveBeenCalledTimes(1);
    act(() => setHidden(false));
    expect(tick).toHaveBeenCalledTimes(2);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('uses the latest callback and does nothing when disabled', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn, on }) => useVisiblePoll(fn, 1000, on), { initialProps: { fn: first, on: true } });
    rerender({ fn: second, on: true });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    rerender({ fn: second, on: false });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
