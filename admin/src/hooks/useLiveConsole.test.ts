// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// vi.mock factories are hoisted above plain consts, so shared mocks go through vi.hoisted.
const { handlers, svc, ingest } = vi.hoisted(() => {
  const handlers: Record<string, any> = {};
  const svc = {
    getLiveResults: vi.fn(),
    getSeatLocks: vi.fn(async () => [{ const_id: 's2', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' }]),
    subscribeLiveUpdates: vi.fn((_e: string, h: any) => { Object.assign(handlers, h); return () => {}; }),
  };
  const ingest = {
    correctSeat: vi.fn(async () => ({ outcome: 'applied', hold_expires_at: '2026-10-03T05:12:00Z' })),
    getHolds: vi.fn(async (): Promise<any[]> => []),
    releaseHold: vi.fn(async () => undefined),
  };
  return { handlers, svc, ingest };
});
vi.mock('../services/live.service', () => svc);
vi.mock('../services/ingest.service', () => ingest);
const ctx = vi.hoisted(() => ({ electionId: 'e1' }));
vi.mock('../context/ElectionContext', () => ({ useElection: () => ({ electionId: ctx.electionId, election: { name: 'Bihar VS 2025' }, error: null }) }));
const setLive = vi.fn();
vi.mock('../context/LiveStatusContext', () => ({ useLiveStatus: () => ({ live: 'idle', setLive }) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ toast: vi.fn(), toastError: vi.fn() }) }));
import { useLiveConsole } from './useLiveConsole';

const c = (status: string, votes: number) => ({ result_id: `r${votes}`, candidate_id: 'c', candidate_name: 'n', party_id: 'P', party_name: 'P', party_color: null, party_abbr: 'P', votes, status, margin: 0, last_updated: '' });
const seats = [
  { const_id: 's1', const_name: 'Phulwari', const_no: 140, const_type: 'GEN', current_round: null, total_rounds: null, candidates: [c('TRAILING', 0)] },
  { const_id: 's2', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24, candidates: [c('LEADING', 10)] },
  { const_id: 's3', const_name: 'Danapur', const_no: 143, const_type: 'GEN', current_round: 24, total_rounds: 24, candidates: [c('WON', 20)] },
];

beforeEach(() => { ctx.electionId = 'e1'; svc.getLiveResults.mockReset(); svc.getLiveResults.mockResolvedValue(seats); ingest.correctSeat.mockClear(); ingest.getHolds.mockReset(); ingest.getHolds.mockResolvedValue([]); ingest.releaseHold.mockClear(); });

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

  it('holdSelection keeps the current seat when the filter hides it', async () => {
    const { result } = renderHook(({ hold }) => useLiveConsole({ holdSelection: hold }), { initialProps: { hold: true } });
    await waitFor(() => expect(result.current.selectedId).toBe('s1'));
    act(() => result.current.setFilter('WON'));
    expect(result.current.selectedId).toBe('s1');
    expect(result.current.selected?.const_id).toBe('s1');
  });

  it('without holdSelection the filter moves the selection', async () => {
    const { result } = renderHook(() => useLiveConsole({ holdSelection: false }));
    await waitFor(() => expect(result.current.selectedId).toBe('s1'));
    act(() => result.current.setFilter('WON'));
    expect(result.current.selectedId).toBe('s3');
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

  it('saveSeat sends the seat to the correction API, then reloads seats and holds', async () => {
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.seats).toHaveLength(3));
    await waitFor(() => expect(ingest.getHolds).toHaveBeenCalledTimes(1));
    const save = { state: 'counting' as const, round: { current: 3, total: 20 }, votes: { c1: 5, c2: 4 } };
    let ok = false;
    await act(async () => { ok = await result.current.saveSeat('s2', save); });
    expect(ok).toBe(true);
    expect(ingest.correctSeat).toHaveBeenCalledWith('e1', 's2', save);
    expect(ingest.getHolds).toHaveBeenCalledTimes(2);
    expect(result.current.lastSavedAt.s2).toBeTruthy();
  });

  it('lists holds and releaseHold deletes one then reloads the list', async () => {
    ingest.getHolds.mockResolvedValue([{ const_id: 's2', const_no: 142, name: 'Patna Sahib', round_at_hold: 4, expires_at: 't', created_by_name: 'A' }]);
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.holds).toHaveLength(1));
    ingest.getHolds.mockResolvedValue([]);
    await act(async () => { await result.current.releaseHold('s2'); });
    expect(ingest.releaseHold).toHaveBeenCalledWith('e1', 's2');
    expect(result.current.holds).toEqual([]);
  });

  it('a late response for the previous election does not replace the new election\'s seats', async () => {
    let resolveOld: (v: unknown) => void = () => {};
    svc.getLiveResults.mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }));
    const e2seats = [{ ...seats[0], const_id: 'x1', const_name: 'Gaya', const_no: 1 }];
    svc.getLiveResults.mockResolvedValueOnce(e2seats);
    const { result, rerender } = renderHook(() => useLiveConsole());
    ctx.electionId = 'e2';
    rerender();
    await waitFor(() => expect(result.current.seats.map((s) => s.const_id)).toEqual(['x1']));
    await act(async () => { resolveOld(seats); });
    expect(result.current.seats.map((s) => s.const_id)).toEqual(['x1']);
    expect(result.current.loading).toBe(false);
  });

  it('drops locks older than the server TTL (holder vanished without a release event)', async () => {
    const fresh = new Date().toISOString();
    const old = new Date(Date.now() - 121_000).toISOString();
    svc.getSeatLocks.mockResolvedValueOnce([
      { const_id: 's1', user_id: 'u3', user_name: 'Old', acquired_at: old },
      { const_id: 's2', user_id: 'u2', user_name: 'Priya S', acquired_at: fresh },
    ]);
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.locks.s2?.user_name).toBe('Priya S'));
    expect(result.current.locks.s1).toBeUndefined();
  });
});
