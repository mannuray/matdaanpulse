// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { useSummaryVM } from '../tiles/useSummaryVM';
import { makeSources } from './fixtures';
import '../../i18n';

function wrap() {
  const sources = makeSources({ availableLayers: ['overview', 'swing', 'battle'] });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/election/e1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DashboardSourcesProvider value={sources}>
        <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={null}>{children}</DashboardStoreProvider>
      </DashboardSourcesProvider>
    </MemoryRouter>
  );
}

describe('useSummaryVM', () => {
  it('follows the active layer', () => {
    const { result } = renderHook(() => ({ vm: useSummaryVM(), store: useDashboardStore() }), { wrapper: wrap() });
    expect(result.current.vm.layer).toBe('overview');
    expect(result.current.vm.summary.layer).toBe('overview');
    act(() => result.current.store.dispatch({ type: 'setLayer', layer: 'swing' }));
    expect(result.current.vm.layer).toBe('swing');
    expect(result.current.vm.summary.layer).toBe('swing');
  });

  it('locks a row with a readable label and a section-scoped chip id', () => {
    const { result } = renderHook(() => ({ vm: useSummaryVM(), store: useDashboardStore() }), { wrapper: wrap() });
    // The first section is the key stats (translated labels); take one with plain labels.
    const section = result.current.vm.summary.sections.find(s => s.rows.length > 0 && !s.rows[0].labelKey)!;
    const row = section.rows[0];
    act(() => result.current.vm.onLockRow(row));
    const locked = result.current.store.state.locked!;
    expect(locked.chipId).toBe(`sum:${section.id}:${row.id}`);
    expect(locked.label).toBe(row.label);
    expect(result.current.vm.lockedRowId).toBe(`${section.id}:${row.id}`);
    act(() => result.current.vm.onLockRow({ id: 'x', label: 'raw', labelKey: 'studio_chip_new', value: 1, valueFormat: 'int' }));
    expect(result.current.store.state.locked?.label).toBe('New seat');
  });

  it('exposes the available layers and switches layer (the focus pills)', () => {
    const { result } = renderHook(() => ({ vm: useSummaryVM(), store: useDashboardStore() }), { wrapper: wrap() });
    expect(result.current.vm.layers).toEqual(['overview', 'swing', 'battle']);
    act(() => result.current.vm.onLayer('battle'));
    expect(result.current.store.state.layer).toBe('battle');
    expect(result.current.vm.summary.layer).toBe('battle');
  });

  it('opens the insight focus, hovers, and selects a seat', () => {
    const { result } = renderHook(() => ({ vm: useSummaryVM(), store: useDashboardStore() }), { wrapper: wrap() });
    act(() => result.current.vm.onFocus());
    expect(result.current.store.state.focus).toBe('insight');
    act(() => result.current.vm.onHoverRow({ id: 'r', label: 'R', value: 1, valueFormat: 'int', seatIds: ['S1'], partyIds: ['BJP'] }));
    expect(result.current.store.state.hover).toEqual({ parties: ['BJP'], seats: ['S1'] });
    act(() => result.current.vm.onSelectSeat('S1'));
    expect(result.current.store.state.selectedSeat).toBe('S1');
  });
});
