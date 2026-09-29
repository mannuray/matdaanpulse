// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';

function setup(url: string | string[], initialIndex?: number) {
  const entries = Array.isArray(url) ? url : [url];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DashboardStoreProvider allowedLayers={['overview', 'swing']} knownSeats={new Set(['A'])}>{children}</DashboardStoreProvider>
    </MemoryRouter>
  );
  return renderHook(() => ({ store: useDashboardStore(), loc: useLocation(), nav: useNavigate() }), { wrapper });
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
  it('closing focus goes back instead of pushing, so history is unchanged', () => {
    const { result } = setup(['/prev', '/election/x'], 1);
    act(() => result.current.store.dispatch({ type: 'focus', tile: 'standings' }));
    expect(result.current.loc.search).toBe('?focus=standings');
    act(() => result.current.store.dispatch({ type: 'focus', tile: null }));
    expect(result.current.loc.pathname).toBe('/election/x');
    expect(result.current.loc.search).toBe('');
    expect(result.current.store.state.focus).toBeNull();
    // Had close pushed, Back would land on the focus entry; it must reach the pre-open page.
    act(() => result.current.nav(-1));
    expect(result.current.loc.pathname).toBe('/prev');
  });
  it('Back after opening focus closes it', () => {
    const { result } = setup(['/prev', '/election/x'], 1);
    act(() => result.current.store.dispatch({ type: 'focus', tile: 'standings' }));
    expect(result.current.store.state.focus).toBe('standings');
    act(() => result.current.nav(-1));
    expect(result.current.store.state.focus).toBeNull();
    expect(result.current.loc.pathname).toBe('/election/x');
    expect(result.current.loc.search).toBe('');
  });
  it('switching tiles while focused replaces rather than pushes', () => {
    const { result } = setup(['/prev', '/election/x'], 1);
    act(() => result.current.store.dispatch({ type: 'focus', tile: 'standings' }));
    act(() => result.current.store.dispatch({ type: 'focus', tile: 'stats' }));
    act(() => result.current.nav(-1));
    expect(result.current.loc.search).toBe('');
  });
  it('closing a focus that came from a pasted link replaces (no history pop)', () => {
    const { result } = setup(['/prev', '/election/x?focus=stats'], 1);
    act(() => result.current.store.dispatch({ type: 'focus', tile: null }));
    expect(result.current.loc.pathname).toBe('/election/x');
    expect(result.current.loc.search).toBe('');
  });
  it('closing focus after a layer change keeps the new layer (replace, no Back)', () => {
    const { result } = setup(['/prev', '/election/x'], 1);
    act(() => result.current.store.dispatch({ type: 'focus', tile: 'standings' }));
    act(() => result.current.store.dispatch({ type: 'setLayer', layer: 'swing' }));
    act(() => result.current.store.dispatch({ type: 'focus', tile: null }));
    expect(result.current.store.state.layer).toBe('swing');
    expect(result.current.loc.pathname).toBe('/election/x');
    expect(result.current.loc.search).toBe('?layer=swing');
    expect(result.current.store.state.focus).toBeNull();
  });
});
