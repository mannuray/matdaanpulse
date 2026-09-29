// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DashboardStoreProvider allowedLayers={['overview', 'swing']} knownSeats={new Set(['A'])}>{children}</DashboardStoreProvider>
    </MemoryRouter>
  );
  return renderHook(() => ({ store: useDashboardStore(), loc: useLocation() }), { wrapper });
}

describe('DashboardStoreProvider', () => {
  it('initialises from the URL and writes changes back', () => {
    const { result } = setup('/election/x?layer=swing');
    expect(result.current.store.state.layer).toBe('swing');
    act(() => result.current.store.dispatch({ type: 'selectSeat', seat: 'A' }));
    expect(result.current.loc.search).toBe('?layer=swing&seat=A&focus=map');
  });
  it('drops an unknown seat from the URL', () => {
    const { result } = setup('/election/x?seat=ZZZ');
    expect(result.current.store.state.selectedSeat).toBeNull();
  });
  it('shows overview for an unavailable layer but keeps it in the URL', () => {
    const { result } = setup('/election/x?layer=history');
    expect(result.current.store.state.layer).toBe('overview');
    expect(result.current.loc.search).toBe('?layer=history');
  });
});
