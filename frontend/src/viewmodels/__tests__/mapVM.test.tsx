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

vi.spyOn(ElectionService, 'getGeoJSON').mockResolvedValue({ type: 'FeatureCollection', features: [] });

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
});
