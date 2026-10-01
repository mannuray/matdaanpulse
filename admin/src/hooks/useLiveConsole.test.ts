// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// vi.mock factories are hoisted above plain consts, so shared mocks go through vi.hoisted.
const { handlers, svc } = vi.hoisted(() => {
  const handlers: Record<string, any> = {};
  const svc = {
    getLiveResults: vi.fn(),
    getSeatLocks: vi.fn(async () => [{ const_id: 's2', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' }]),
    bulkOverride: vi.fn(async () => ({ updated: 2 })),
    subscribeLiveUpdates: vi.fn((_e: string, h: any) => { Object.assign(handlers, h); return () => {}; }),
  };
  return { handlers, svc };
});
vi.mock('../services/election.service', () => svc);
vi.mock('../context/ElectionContext', () => ({ useElection: () => ({ electionId: 'e1', election: { name: 'Bihar VS 2025' } }) }));
const setLive = vi.fn();
vi.mock('../context/ShellStatusContext', () => ({ useShellStatus: () => ({ live: 'idle', setLive }) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ toast: vi.fn(), toastError: vi.fn() }) }));
import { useLiveConsole } from './useLiveConsole';

const c = (status: string, votes: number) => ({ result_id: `r${votes}`, candidate_id: 'c', candidate_name: 'n', party_id: 'P', party_name: 'P', party_color: null, party_abbr: 'P', votes, status, margin: 0, last_updated: '' });
const seats = [
  { const_id: 's1', const_name: 'Phulwari', const_no: 140, const_type: 'GEN', current_round: null, total_rounds: null, candidates: [c('TRAILING', 0)] },
  { const_id: 's2', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24, candidates: [c('LEADING', 10)] },
  { const_id: 's3', const_name: 'Danapur', const_no: 143, const_type: 'GEN', current_round: 24, total_rounds: 24, candidates: [c('WON', 20)] },
];

beforeEach(() => { svc.getLiveResults.mockResolvedValue(seats); svc.bulkOverride.mockClear(); });

describe('useLiveConsole', () => {
  it('counts, filters, searches and auto-selects', async () => {
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.seats).toHaveLength(3));
    expect(result.current.counts).toEqual({ all: 3, PENDING: 1, LEADING: 1, WON: 1 });
    expect(result.current.selectedId).toBe('s1');
    expect(result.current.reportingPct).toBe(67);
    act(() => result.current.setFilter('WON'));
    expect(result.current.seats.map((s) => s.const_id)).toEqual(['s3']);
    expect(result.current.selectedId).toBe('s3');
    act(() => { result.current.setFilter('all'); result.current.setSearch('14'); });
    expect(result.current.seats.map((s) => s.const_no)).toEqual([140, 142, 143]);
    act(() => result.current.setSearch('patna'));
    expect(result.current.seats.map((s) => s.const_id)).toEqual(['s2']);
  });

  it('move() walks the filtered list and stops at the ends', async () => {
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.selectedId).toBe('s1'));
    act(() => result.current.move(1));
    expect(result.current.selectedId).toBe('s2');
    act(() => result.current.move(-1));
    act(() => result.current.move(-1));
    expect(result.current.selectedId).toBe('s1');
  });

  it('loads locks and applies seat-lock events', async () => {
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.locks.s2?.user_name).toBe('Priya S'));
    act(() => handlers.onSeatLock({ const_id: 's2', lock: null }));
    expect(result.current.locks.s2).toBeUndefined();
  });

  it('reports SSE status to the shell and resets to idle on unmount', async () => {
    const { unmount } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(svc.subscribeLiveUpdates).toHaveBeenCalled());
    act(() => handlers.onStatus('open'));
    expect(setLive).toHaveBeenCalledWith('open');
    unmount();
    expect(setLive).toHaveBeenLastCalledWith('idle');
  });

  it('saveSeat sends one bulk call and records lastSavedAt', async () => {
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.seats).toHaveLength(3));
    let ok = false;
    await act(async () => { ok = await result.current.saveSeat('s2', { overrides: [{ result_id: 'r10', votes: 11, status: 'LEADING', margin: 11 }], rounds: { current_round: 5 } }); });
    expect(ok).toBe(true);
    expect(svc.bulkOverride).toHaveBeenCalledWith('e1', [{ result_id: 'r10', votes: 11, status: 'LEADING', margin: 11 }], { s2: { current_round: 5 } });
    expect(result.current.lastSavedAt.s2).toBeTruthy();
  });
});
