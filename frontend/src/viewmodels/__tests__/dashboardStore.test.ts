import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dashboardReducer, initialUiState, activeHighlight, parseUiParams, serializeUiParams, effectiveLayer } from '../store/dashboardStore';
import { createHoverIntent, intentFor } from '../store/hoverIntent';

const hl = { parties: ['BJP'], seats: [] };

describe('dashboardReducer', () => {
  it('changing layer clears a locked highlight', () => {
    const locked = dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'BJP', highlight: hl, label: 'BJP' });
    expect(dashboardReducer(locked, { type: 'setLayer', layer: 'swing' })).toMatchObject({ layer: 'swing', locked: null });
  });
  it('toggleLock on the same chip unlocks', () => {
    const once = dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'BJP', highlight: hl, label: 'BJP' });
    expect(dashboardReducer(once, { type: 'toggleLock', chipId: 'BJP', highlight: hl, label: 'BJP' }).locked).toBeNull();
  });
  it('selecting a seat opens the map focus view', () => {
    expect(dashboardReducer(initialUiState, { type: 'selectSeat', seat: 'X' })).toMatchObject({ selectedSeat: 'X', focus: 'map' });
  });
  it('closing focus also clears the selected seat', () => {
    const s = dashboardReducer(initialUiState, { type: 'selectSeat', seat: 'X' });
    expect(dashboardReducer(s, { type: 'focus', tile: null })).toMatchObject({ focus: null, selectedSeat: null });
  });
});

describe('activeHighlight', () => {
  const locked = () => dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'c', highlight: { parties: [], seats: ['A'] }, label: 'c' });
  it('hover previews over a locked highlight', () => {
    const s = dashboardReducer(locked(), { type: 'hover', highlight: { parties: [], seats: ['B'] } });
    expect([...activeHighlight(s).seats]).toEqual(['B']);
  });
  it('clearing the hover returns to the locked highlight', () => {
    let s = dashboardReducer(locked(), { type: 'hover', highlight: { parties: [], seats: ['B'] } });
    s = dashboardReducer(s, { type: 'hover', highlight: null });
    expect([...activeHighlight(s).seats]).toEqual(['A']);
  });
  it('an empty hover (a row with no seats) does not hide the locked highlight', () => {
    const s = dashboardReducer(locked(), { type: 'hover', highlight: { parties: [], seats: [] } });
    expect([...activeHighlight(s).seats]).toEqual(['A']);
  });
});

describe('refreshLock', () => {
  it('replaces the highlight of the locked chip only', () => {
    const locked = dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'c', highlight: { parties: [], seats: ['A'] }, label: 'c' });
    expect(dashboardReducer(locked, { type: 'refreshLock', chipId: 'c', highlight: { parties: [], seats: ['A', 'B'] } }).locked!.highlight.seats).toEqual(['A', 'B']);
    expect(dashboardReducer(locked, { type: 'refreshLock', chipId: 'other', highlight: { parties: [], seats: ['Z'] } })).toBe(locked);
  });
});

describe('createHoverIntent', () => {
  const setup = () => {
    const actions: unknown[] = [];
    return { actions, hover: createHoverIntent(a => actions.push(a), 100) };
  };
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('dispatches a hover immediately', () => {
    const { actions, hover } = setup();
    hover(hl);
    expect(actions).toEqual([{ type: 'hover', highlight: hl }]);
  });
  it('delays the clear by ~100ms', () => {
    const { actions, hover } = setup();
    hover(hl); hover(null);
    vi.advanceTimersByTime(99);
    expect(actions).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(actions[1]).toEqual({ type: 'hover', highlight: null });
  });
  it('the next hover cancels the pending clear (no flash between rows)', () => {
    const { actions, hover } = setup();
    const next = { parties: [], seats: ['B'] };
    hover(hl); hover(null);
    vi.advanceTimersByTime(40);
    hover(next);
    vi.advanceTimersByTime(500);
    expect(actions).toEqual([{ type: 'hover', highlight: hl }, { type: 'hover', highlight: next }]);
  });
  it('cancel drops a pending clear', () => {
    const { actions, hover } = setup();
    hover(hl); hover(null);
    hover.cancel();
    vi.advanceTimersByTime(500);
    expect(actions).toHaveLength(1);
  });
  it('one intent is shared per dispatch function, so another source cannot be wiped by a stale clear', () => {
    const d = () => {};
    expect(intentFor(d)).toBe(intentFor(d));
    expect(intentFor(d)).not.toBe(intentFor(() => {}));
  });
});

describe('URL params', () => {
  it('round-trips layer, seat and focus', () => {
    const s = { ...initialUiState, layer: 'swing' as const, selectedSeat: 'A', focus: 'map' as const };
    const p = serializeUiParams(s, new URLSearchParams('keep=1'));
    expect(p.toString()).toBe('keep=1&layer=swing&seat=A&focus=map');
    expect(parseUiParams(p, new Set(['A']))).toEqual({ layer: 'swing', selectedSeat: 'A', focus: 'map' });
  });
  it('ignores bogus values from hand-edited URLs', () => {
    const p = new URLSearchParams('layer=bogus&focus=nope&seat=NOT_A_SEAT');
    expect(parseUiParams(p, new Set(['A']))).toEqual({ layer: 'overview', selectedSeat: null, focus: null });
  });
  it('accepts any seat while the seat list is still loading', () => {
    expect(parseUiParams(new URLSearchParams('seat=X'), null).selectedSeat).toBe('X');
  });
  it('shows overview for a layer this election does not have (yet)', () => {
    expect(effectiveLayer('swing', ['overview', 'battle'])).toBe('overview');
    expect(effectiveLayer('swing', ['overview', 'swing'])).toBe('swing');
  });
  it('does not write default values', () => {
    expect(serializeUiParams(initialUiState, new URLSearchParams()).toString()).toBe('');
  });
});
