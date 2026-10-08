// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { useScoreboardVM } from '../tiles/useScoreboardVM';
import { countDeclared } from '../../model/derive/marginStats';
import { useStandingsVM } from '../tiles/useStandingsVM';
import { useStatsVM } from '../tiles/useStatsVM';
import { useLayerInsightVM } from '../tiles/useLayerInsightVM';
import { makeSources } from './fixtures';
import '../../i18n';

function wrap(sources = makeSources()) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/election/e1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DashboardSourcesProvider value={sources}>
        <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider>
      </DashboardSourcesProvider>
    </MemoryRouter>
  );
}

describe('tile view-models', () => {
  it('scoreboard: blocs from alliances, status final, focus intent', () => {
    const { result } = renderHook(() => ({ vm: useScoreboardVM(), store: useDashboardStore() }), { wrapper: wrap() });
    expect(result.current.vm.blocs.map(b => [b.id, b.seats])).toEqual([['NDA', 3], ['MGB', 0]]);
    expect(result.current.vm.status).toBe('final');
    expect(result.current.vm.declared).toBe(countDeclared(makeSources().data.mapRegions));
    act(() => result.current.vm.onFocus());
    expect(result.current.store.state.focus).toBe('scoreboard');
  });

  it('scoreboard: label is the alliance id for long names, the name when short', () => {
    const base = makeSources();
    const src = makeSources({ data: { ...base.data, manifestData: { alliances: [
      { id: 'NDA', name: 'National Democratic Alliance', color: '#FF7A1A', parties: ['BJP', 'JDU'] },
      { id: 'MGB', name: 'Left Front', color: '#7BD34A', parties: ['RJD'] },
    ] } } as typeof base.data });
    const { result } = renderHook(() => useScoreboardVM(), { wrapper: wrap(src) });
    expect(result.current.blocs.map(b => [b.id, b.label, b.name])).toEqual([['NDA', 'NDA', 'National Democratic Alliance'], ['MGB', 'Left Front', 'Left Front']]);
  });

  it('scoreboard: locking a bloc stores its short label', () => {
    const { result } = renderHook(() => ({ vm: useScoreboardVM(), store: useDashboardStore() }), { wrapper: wrap() });
    act(() => result.current.vm.onLockBloc('NDA'));
    expect(result.current.store.state.locked).toMatchObject({ chipId: 'bloc:NDA', label: 'NDA' });
  });

  it('insight: locking a chip stores its resolved label', () => {
    const { result } = renderHook(() => ({ vm: useLayerInsightVM(), store: useDashboardStore() }), { wrapper: wrap() });
    act(() => result.current.vm.onLockChip({ id: 'x', label: 'Plain label', color: '#fff', count: 1, seatIds: ['S'] }));
    expect(result.current.store.state.locked).toMatchObject({ chipId: 'chip:x', label: 'Plain label' });
    act(() => result.current.vm.onLockChip({ id: 'y', label: 'raw', labelKey: 'studio_chip_new', color: '#fff', count: 1, seatIds: ['S'] }));
    expect(result.current.store.state.locked?.label).toBe('New seat');
  });

  it('standings: locking a party highlights it', () => {
    const { result } = renderHook(() => ({ vm: useStandingsVM(), store: useDashboardStore() }), { wrapper: wrap() });
    expect(result.current.vm.rows.map(r => r.id)).toEqual(['JDU', 'BJP']);
    expect(result.current.vm.allRows).toHaveLength(3);
    act(() => result.current.vm.onLockParty('BJP'));
    expect(result.current.store.state.locked).toEqual({ chipId: 'party:BJP', highlight: { parties: ['BJP'], seats: [] }, label: 'BJP' });
    expect(result.current.vm.lockedId).toBe('BJP');
  });

  it('stats: real closest / biggest from results', () => {
    const { result } = renderHook(() => useStatsVM(), { wrapper: wrap() });
    expect(result.current.stats.closest).toMatchObject({ id: 'BR_VS_1_SANDESH', margin: 27 });
    expect(result.current.stats.biggest).toMatchObject({ id: 'BR_VS_2_RUPAULI', margin: 73572 });
    expect(result.current.isLive).toBe(false);
  });

  it('layer insight follows the active layer', () => {
    const { result } = renderHook(() => ({ vm: useLayerInsightVM(), store: useDashboardStore() }), { wrapper: wrap() });
    expect(result.current.vm.insight?.headlineKey).toBe('studio_insight_overview');
    act(() => result.current.store.dispatch({ type: 'setLayer', layer: 'battle' }));
    expect(result.current.vm.insight?.headlineKey).toBe('studio_insight_battle');
  });
});
