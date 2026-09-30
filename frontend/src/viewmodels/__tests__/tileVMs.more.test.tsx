// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import * as electionApi from '../../model/api/election.service';
import * as geoApi from '../../model/api/geo.service';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { ElectionProvider } from '../data/useElection';
import { useTopBarVM } from '../tiles/useTopBarVM';
import { useLeadersVM } from '../tiles/useLeadersVM';
import { useSeatPanelVM } from '../tiles/useSeatPanelVM';
import { useLocalStorage } from '../data/useLocalStorage';
import type { CustomWatch } from '../../model/derive/leaders';
import '../../i18n';
import { makeSources } from './fixtures';

const base = makeSources().election;
const el = (id: string, type: 'LS' | 'VS', year: number, state_id: number | null) =>
  ({ ...base, id, name: `${type} ${year} ${id}`, type, year, state_id, status: 'Finalized' }) as typeof base;

// Deliberately unsorted, older VS first, so "first found" differs from "most recent".
const ELECTIONS = [
  el('br2020', 'VS', 2020, 4), el('wb2016', 'VS', 2016, 5), el('br2025', 'VS', 2025, 4),
  el('wb2021', 'VS', 2021, 5), el('ls2019', 'LS', 2019, null), el('ls2024', 'LS', 2024, null),
];
const STATES = [{ id: 4, name: 'Bihar' }, { id: 5, name: 'West Bengal' }];

function wrap(sources = makeSources()) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/election/e1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ElectionProvider>
        <DashboardSourcesProvider value={sources}>
          <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={null}>{children}</DashboardStoreProvider>
        </DashboardSourcesProvider>
      </ElectionProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(electionApi, 'getElections').mockResolvedValue(ELECTIONS as never);
  vi.spyOn(geoApi, 'getStates').mockResolvedValue(STATES as never);
});
afterEach(() => { vi.restoreAllMocks(); });

async function topBar(type: 'LS' | 'VS') {
  const sources = makeSources({ election: { ...base, type } });
  const hook = renderHook(() => ({ vm: useTopBarVM(), loc: useLocation() }), { wrapper: wrap(sources) });
  await waitFor(() => expect(hook.result.current.vm.lsElections.length).toBe(2));
  return hook;
}

describe('useTopBarVM', () => {
  it('electionLabel combines type, state and year (LS has no state)', async () => {
    const vs = makeSources({ election: { ...base, type: 'VS', year: 2025, state_id: 4 } });
    const h1 = renderHook(() => useTopBarVM(), { wrapper: wrap(vs) });
    await waitFor(() => expect(h1.result.current.electionLabel).toBe('VS · Bihar 2025'));
    const ls = makeSources({ election: { ...base, type: 'LS', year: 2024, state_id: null } });
    const h2 = renderHook(() => useTopBarVM(), { wrapper: wrap(ls) });
    await waitFor(() => expect(h2.result.current.electionLabel).toBe('LS · 2024'));
  });

  it('a failed /elections still offers the current state and year, and is retried once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = vi.spyOn(electionApi, 'getElections').mockRejectedValueOnce(new Error('429')).mockResolvedValue(ELECTIONS as never);
    const vs = makeSources({ election: { ...base, id: 'cur', type: 'VS', year: 2025, state_id: 4, state: { id: 4, name: 'Bihar' } as never } });
    const { result } = renderHook(() => useTopBarVM(), { wrapper: wrap(vs) });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.years).toEqual([{ id: 'cur', year: 2025 }]));
    expect(result.current.states).toEqual([{ id: 4, name: 'Bihar' }]);
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.years.map(y => y.id)).toEqual(['br2025', 'br2020']));
    vi.useRealTimers();
  });

  it('LS -> VS restores the remembered VS election', async () => {
    localStorage.setItem('lastElection_VS', 'wb2016');
    const { result } = await topBar('LS');
    act(() => result.current.vm.onType('VS'));
    expect(result.current.loc.pathname).toBe('/election/wb2016');
  });

  it('LS -> VS with nothing remembered goes to the most recent VS election', async () => {
    const { result } = await topBar('LS');
    act(() => result.current.vm.onType('VS'));
    expect(result.current.loc.pathname).toBe('/election/br2025');
  });

  it('onState goes to the latest election of that state', async () => {
    const { result } = await topBar('VS');
    act(() => result.current.vm.onState(5));
    expect(result.current.loc.pathname).toBe('/election/wb2021');
  });

  it('onElection navigates and remembers per type', async () => {
    const { result } = await topBar('VS');
    act(() => result.current.vm.onElection('br2020'));
    expect(result.current.loc.pathname).toBe('/election/br2020');
    expect(localStorage.getItem('lastElection_VS')).toBe('br2020');
    act(() => result.current.vm.onElection('ls2019'));
    expect(result.current.loc.pathname).toBe('/election/ls2019');
    expect(localStorage.getItem('lastElection_LS')).toBe('ls2019');
  });
});

// Sources with a live shared watchlist (same single useLocalStorage as useDashboardSources).
function sharedWatchWrap() {
  function Shared({ children }: { children: ReactNode }) {
    const [list, setList] = useLocalStorage<CustomWatch[]>('watchlist_e1', []);
    const sources = makeSources({
      watchlist: list,
      addWatch: (id, label) => setList(p => p.some(w => w.const_id === id) ? p : [...p, { const_id: id, label }]),
      removeWatch: id => setList(p => p.filter(w => w.const_id !== id)),
    });
    return wrap(sources)({ children });
  }
  return Shared;
}

describe('shared watchlist (seat panel + leaders)', () => {
  it('track from the seat panel shows in useLeadersVM().watchlist; leaders exclude custom; remove works', () => {
    const { result } = renderHook(() => ({ leaders: useLeadersVM(), seat: useSeatPanelVM(), store: useDashboardStore() }), { wrapper: sharedWatchWrap() });
    act(() => result.current.store.dispatch({ type: 'selectSeat', seat: 'BR_VS_3_AGIAON' }));
    expect(result.current.seat!.tracked).toBe(false);
    act(() => result.current.seat!.onToggleTrack());
    expect(result.current.seat!.tracked).toBe(true);
    expect(JSON.parse(localStorage.getItem('watchlist_e1')!)).toHaveLength(1);
    expect(result.current.leaders.watchlist.map(c => c.constId)).toEqual(['BR_VS_3_AGIAON']);
    expect(result.current.leaders.watchlist[0].custom).toBe(true);
    expect(result.current.leaders.leaders.some(c => c.custom)).toBe(false);
    act(() => result.current.leaders.onRemoveCustom('BR_VS_3_AGIAON'));
    expect(result.current.seat!.tracked).toBe(false);
    expect(JSON.parse(localStorage.getItem('watchlist_e1')!)).toEqual([]);
    expect(result.current.leaders.watchlist).toEqual([]);
  });

  it('onAddCustom dedupes and toggling an already tracked seat untracks it', () => {
    const { result } = renderHook(() => ({ leaders: useLeadersVM(), seat: useSeatPanelVM(), store: useDashboardStore() }), { wrapper: sharedWatchWrap() });
    act(() => result.current.leaders.onAddCustom('BR_VS_3_AGIAON'));
    act(() => result.current.leaders.onAddCustom('BR_VS_3_AGIAON'));
    expect(JSON.parse(localStorage.getItem('watchlist_e1')!)).toHaveLength(1);
    act(() => result.current.store.dispatch({ type: 'selectSeat', seat: 'BR_VS_3_AGIAON' }));
    expect(result.current.seat!.tracked).toBe(true);
    act(() => result.current.seat!.onToggleTrack());
    expect(result.current.leaders.watchlist).toEqual([]);
  });
});

describe('useSeatPanelVM', () => {
  it('is null without a selected seat; then returns seat data without fetching an analysis', async () => {
    const analysis = vi.spyOn(electionApi, 'getConstituencyAnalysis');
    const { result } = renderHook(() => ({ vm: useSeatPanelVM(), store: useDashboardStore() }), { wrapper: wrap() });
    expect(result.current.vm).toBeNull();
    act(() => result.current.store.dispatch({ type: 'selectSeat', seat: 'BR_VS_1_SANDESH' }));
    await waitFor(() => expect(result.current.vm).not.toBeNull());
    const vm = result.current.vm!;
    expect(analysis).not.toHaveBeenCalled();
    expect(vm.margin).toBe(27);
    expect(vm.candidates.map(c => c.partyId)).toEqual(['JDU', 'RJD']);
    expect(vm.name.toLowerCase()).toContain('sandesh');
    expect(vm.fullPageHref).toBe('/election/e1/constituency/BR_VS_1_SANDESH');
  });
});
