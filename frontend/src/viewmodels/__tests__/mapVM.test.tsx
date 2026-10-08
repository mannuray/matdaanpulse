// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { useMapVM } from '../tiles/useMapVM';
import { ElectionService } from '../../model/api/election.service';
import { makeSources } from './fixtures';
import '../../i18n';

const getGeoJSON = vi.spyOn(ElectionService, 'getGeoJSON').mockResolvedValue({ type: 'FeatureCollection', features: [] });

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardSourcesProvider value={makeSources()}><DashboardStoreProvider allowedLayers={['overview', 'battle']} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider></DashboardSourcesProvider></MemoryRouter>
);

describe('useMapVM', () => {
  it('loads geometry, exposes fills per seat and hides hex without a layout', async () => {
    const { result } = renderHook(() => useMapVM(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.fills.get('BR_VS_1_SANDESH')).toEqual({ color: '#1FA37A', opacity: 1, highlighted: false });
    expect(result.current.hexAvailable).toBe(false);
    expect(result.current.lockedLabel).toBeNull();
    act(() => result.current.onLayer('battle'));
    expect(result.current.fills.get('BR_VS_1_SANDESH')?.opacity).toBe(0.25);
  });

  it('lockedLabel is the resolved label, not the internal chip id', async () => {
    const { result } = renderHook(() => ({ vm: useMapVM(), store: useDashboardStore() }), { wrapper });
    await waitFor(() => expect(result.current.vm.status).toBe('ready'));
    act(() => result.current.store.dispatch({ type: 'toggleLock', chipId: 'chip:bucket-0', highlight: { parties: [], seats: ['A'] }, label: 'Under 5%' }));
    expect(result.current.vm.lockedLabel).toBe('Under 5%');
  });

  it('seatInfo carries the state: the election state for VS, the PC map state for LS', async () => {
    const vs = renderHook(() => useMapVM(), { wrapper });
    await waitFor(() => expect(vs.result.current.status).toBe('ready'));
    expect(vs.result.current.seatInfo('BR_VS_1_SANDESH')).toMatchObject({ name: 'Sandesh', state: 'Bihar' });
    const base = makeSources();
    const ls = makeSources({
      election: { ...base.election, type: 'LS', state_id: null, state: null },
      data: { ...base.data, mapRegions: base.data.mapRegions.map((r, i) => ({ ...r, state: i === 0 ? 'Uttar Pradesh' : undefined })) },
    });
    const lsWrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardSourcesProvider value={ls}><DashboardStoreProvider allowedLayers={['overview']} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider></DashboardSourcesProvider></MemoryRouter>
    );
    const r = renderHook(() => useMapVM(), { wrapper: lsWrapper });
    await waitFor(() => expect(r.result.current.status).toBe('ready'));
    expect(r.result.current.seatInfo(ls.data.mapRegions[0].id)?.state).toBe('Uttar Pradesh');
    expect(r.result.current.seatInfo(ls.data.mapRegions[1].id)?.state).toBeNull();
  });

  it('a tied counting seat (no leader) reads "Tied" in the hover card, with the Too close call', async () => {
    const base = makeSources();
    const regions = base.data.mapRegions.map(r => (r.id === 'BR_VS_1_SANDESH' ? { ...r, party: '', status: 'TRAILING', candidate: '' } : r));
    const live = new Map([['BR_VS_1_SANDESH', { const_id: 'BR_VS_1_SANDESH', call: 'too_close', momentum: null }], ['BR_VS_2_RUPAULI', { const_id: 'BR_VS_2_RUPAULI', call: 'likely', momentum: null }]]);
    const tied = makeSources({ election: { ...base.election, status: 'Live' }, data: { ...base.data, mapRegions: regions }, liveAnalysis: { seats: live, tally: {} } as never });
    const w = ({ children }: { children: ReactNode }) => (
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardSourcesProvider value={tied}><DashboardStoreProvider allowedLayers={['overview']} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider></DashboardSourcesProvider></MemoryRouter>
    );
    const { result } = renderHook(() => useMapVM(), { wrapper: w });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.seatInfo('BR_VS_1_SANDESH')).toMatchObject({ status: 'Tied', live: { call: 'Too close' } });
  });

  describe('which map file (never India for a state election)', () => {
    const run = (over: Parameters<typeof makeSources>[0]) => {
      const src = makeSources(over);
      const w = ({ children }: { children: ReactNode }) => (
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardSourcesProvider value={src}><DashboardStoreProvider allowedLayers={['overview']} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider></DashboardSourcesProvider></MemoryRouter>
      );
      return renderHook(() => useMapVM(), { wrapper: w });
    };
    const base = makeSources();

    it('a state election whose manifest is still loading stays "loading" and fetches no map (no India flash)', async () => {
      getGeoJSON.mockClear();
      const { result } = run({ data: { ...base.data, manifestData: null, manifestLoaded: false } });
      await new Promise(r => setTimeout(r, 20));
      expect(result.current.status).toBe('loading');
      expect(getGeoJSON).not.toHaveBeenCalled();
    });

    it('a state election whose manifest names no map is "unavailable", not India', async () => {
      getGeoJSON.mockClear();
      const { result } = run({ data: { ...base.data, manifestData: { alliances: [] }, manifestLoaded: true } });
      await waitFor(() => expect(result.current.status).toBe('unavailable'));
      expect(getGeoJSON).not.toHaveBeenCalled();
    });

    it('a state election loads exactly its own map file', async () => {
      getGeoJSON.mockClear();
      const { result } = run({});
      await waitFor(() => expect(result.current.status).toBe('ready'));
      expect(getGeoJSON.mock.calls.map(c => c[0])).toEqual(['/geo/bihar_ac_2008.geojson']);
    });

    it('Lok Sabha still falls back to the India PC map without a manifest map', async () => {
      getGeoJSON.mockClear();
      const { result } = run({ election: { ...base.election, type: 'LS', state_id: null, state: null }, data: { ...base.data, manifestData: null, manifestLoaded: false } });
      await waitFor(() => expect(result.current.status).toBe('ready'));
      expect(getGeoJSON.mock.calls.map(c => c[0])).toContain('/geo/india_pc_2008.geojson');
    });
  });
});
