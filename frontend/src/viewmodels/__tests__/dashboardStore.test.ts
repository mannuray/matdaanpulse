import { describe, it, expect } from 'vitest';
import { dashboardReducer, initialUiState, activeHighlight, parseUiParams, serializeUiParams, effectiveLayer } from '../store/dashboardStore';

const hl = { parties: ['BJP'], seats: [] };

describe('dashboardReducer', () => {
  it('changing layer clears a locked highlight', () => {
    const locked = dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'BJP', highlight: hl });
    expect(dashboardReducer(locked, { type: 'setLayer', layer: 'swing' })).toMatchObject({ layer: 'swing', locked: null });
  });
  it('toggleLock on the same chip unlocks', () => {
    const once = dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'BJP', highlight: hl });
    expect(dashboardReducer(once, { type: 'toggleLock', chipId: 'BJP', highlight: hl }).locked).toBeNull();
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
  it('prefers the locked highlight over hover', () => {
    let s = dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'c', highlight: { parties: [], seats: ['A'] } });
    s = dashboardReducer(s, { type: 'hover', highlight: hl });
    expect([...activeHighlight(s).seats]).toEqual(['A']);
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
