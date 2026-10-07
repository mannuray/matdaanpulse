// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { makeSources } from './fixtures';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';

const getConstituency = vi.fn();
const getConstituencyAnalysis = vi.fn();
const getSeatRounds = vi.fn();
vi.mock('../../model/api/election.service', async (orig) => ({
  ...(await orig<typeof import('../../model/api/election.service')>()),
  getConstituency: (...a: unknown[]) => getConstituency(...a),
  getConstituencyAnalysis: (...a: unknown[]) => getConstituencyAnalysis(...a),
  getSeatRounds: (...a: unknown[]) => getSeatRounds(...a),
}));

import { useSeatDialogVM } from '../tiles/useSeatDialogVM';
import type { SeatLive, SeatBaseline } from '../../model/derive/seatAnalysis';

function wrap(url: string, sources = makeSources()) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      <DashboardSourcesProvider value={sources}>
        <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider>
      </DashboardSourcesProvider>
    </MemoryRouter>
  );
}

describe('useSeatDialogVM', () => {
  it('is null without a selected seat', () => {
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/') });
    expect(result.current).toBeNull();
  });

  it('shows live rows at once and the facts once the detail arrives', async () => {
    getConstituency.mockResolvedValue({ id: 'BR_VS_1_SANDESH', name: 'Sandesh', const_no: 1, type: 'SC', total_electors: 2000, voter_turnout: 59.4, phase: 1,
      current_round: null, total_rounds: null, last_updated: null, state: { id: 4, name: 'Bihar' }, district: { id: 1, name: 'Bhojpur' }, candidates: [] });
    getConstituencyAnalysis.mockResolvedValue(null);
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    expect(result.current?.view.candidates.map(c => c.name)).toEqual(['RADHA CHARAN SAH', 'R']);
    expect(result.current?.detailState).toBe('loading');
    await waitFor(() => expect(result.current?.detailState).toBe('ready'));
    expect(result.current).toMatchObject({ name: 'Sandesh', type: 'SC', place: 'Bhojpur · Bihar', electors: 2000, turnout: 59.4, phase: 1, live: { kind: 'declared' } });
  });

  it('a failed detail keeps the live rows and reports error', async () => {
    getConstituency.mockRejectedValue(new Error('boom'));
    getConstituencyAnalysis.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    await waitFor(() => expect(result.current?.detailState).toBe('error'));
    expect(result.current?.view.candidates).toHaveLength(2);
  });

  it('does not show the previous seat\'s detail while the next seat loads', async () => {
    getConstituency.mockImplementation((_e: string, id: string) => id === 'BR_VS_1_SANDESH'
      ? Promise.resolve({ id, name: 'Sandesh', const_no: 1, type: 'SC', total_electors: 2000, voter_turnout: 59.4, phase: 1, current_round: null, total_rounds: null, state: { id: 4, name: 'Bihar' }, district: { id: 1, name: 'Bhojpur' }, candidates: [] })
      : new Promise(() => {}));
    getConstituencyAnalysis.mockResolvedValue(null);
    const { result } = renderHook(() => ({ vm: useSeatDialogVM(), store: useDashboardStore() }), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    await waitFor(() => expect(result.current.vm?.detailState).toBe('ready'));
    expect(result.current.vm?.electors).toBe(2000);
    act(() => result.current.store.dispatch({ type: 'selectSeat', seat: 'BR_VS_2_BARHARA' }));
    expect(result.current.vm?.seatId).toBe('BR_VS_2_BARHARA');
    expect(result.current.vm?.name).not.toBe('Sandesh');
    expect(result.current.vm?.electors).toBeNull();
    expect(result.current.vm?.place).toBeNull();
    expect(result.current.vm?.detailState).toBe('loading');
  });

  it('refetches the detail when the live version changes on a Live election', async () => {
    getConstituency.mockClear();
    getConstituency.mockResolvedValue(null);
    getConstituencyAnalysis.mockResolvedValue(null);
    const mk = (liveVersion: number) => { const s = makeSources(); return makeSources({ election: { ...s.election, status: 'Live' }, data: { ...s.data, liveVersion } }); };
    let sources = mk(1);
    const W = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/?seat=BR_VS_1_SANDESH']}>
        <DashboardSourcesProvider value={sources}>
          <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider>
        </DashboardSourcesProvider>
      </MemoryRouter>
    );
    const { rerender } = renderHook(() => useSeatDialogVM(), { wrapper: W });
    await waitFor(() => expect(getConstituency).toHaveBeenCalledTimes(1));
    sources = mk(2);
    rerender();
    await waitFor(() => expect(getConstituency).toHaveBeenCalledTimes(2));
  });

  it('opening a party from the dialog selects it in the store', () => {
    getConstituency.mockResolvedValue(null);
    getConstituencyAnalysis.mockResolvedValue(null);
    const { result } = renderHook(() => ({ vm: useSeatDialogVM(), store: useDashboardStore() }), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    act(() => result.current.vm!.onOpenParty('JDU'));
    expect(result.current.store.state.selectedParty).toBe('JDU');
  });

  it('a Finalized seat has no live block and fetches no rounds', async () => {
    getConstituency.mockResolvedValue(null); getConstituencyAnalysis.mockResolvedValue(null); getSeatRounds.mockReset();
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({ liveSeat: null, upsets: [], trend: [], narrowed: null });
    expect(getSeatRounds).not.toHaveBeenCalled();
  });

  it('a live seat: its SeatLive, upset badges, the margin trend from the rounds endpoint, refetched on a new version', async () => {
    getConstituency.mockResolvedValue(null); getConstituencyAnalysis.mockResolvedValue(null);
    getSeatRounds.mockReset().mockResolvedValue([{ seq: 1, r: 1, rt: 20, lp: 'BJP', m: 300, v: 900, declared: false, at: '' }, { seq: 2, r: 2, rt: 20, lp: 'RJD', m: 120, v: 1800, declared: false, at: '' }]);
    const seatLive = { const_id: 'BR_VS_1_SANDESH', call: 'too_close', momentum: 'narrowing', upsets: ['sitting_trailing'], margin: 120, lead_changes: 1, comeback: false } as unknown as SeatLive;
    const base = makeSources();
    const live = (version: number) => ({ ...base, election: { ...base.election, status: 'Live' as const }, data: { ...base.data, liveVersion: version, trails: {} },
      liveAnalysis: { seats: new Map([[seatLive.const_id, seatLive]]), tally: { parties: [], flow: [], alliance_moves: [] } },
      baselineSeats: new Map([[seatLive.const_id, { sitting: { name: 'Asha Devi', party: 'BJP' } } as unknown as SeatBaseline]]) });
    let sources = live(7);
    const { result, rerender } = renderHook(() => useSeatDialogVM(), { wrapper: ({ children }) => wrap('/?seat=BR_VS_1_SANDESH', sources)({ children }) });
    await waitFor(() => expect(result.current?.trend).toHaveLength(2));
    expect(result.current?.liveSeat?.call).toBe('too_close');
    expect(result.current?.upsets).toEqual([{ kind: 'sitting_trailing', name: 'Asha Devi', party: 'BJP', margin: 120 }]);
    expect(result.current?.trend[1]).toMatchObject({ x: 2, party: 'RJD', switched: true });
    sources = live(8); rerender();
    await waitFor(() => expect(getSeatRounds).toHaveBeenCalledTimes(2));
  });
});

