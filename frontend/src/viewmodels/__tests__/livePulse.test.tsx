// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import { memo } from 'react';
import { useLivePulse, RECENT_CHANGE_MS } from '../sources/useLivePulse';
import { DashboardSourcesProvider, LivePulseProvider, useSources, useLivePulseState } from '../sources/DashboardSourcesProvider';
import { makeSources } from './fixtures';
import type { ResultRow } from '../../model/types';

afterEach(() => vi.useRealTimers());
const row = (const_id: string, party_id: string, status = 'LEADING', votes = 10): ResultRow => ({ const_id, party_id, candidate_name: 'x', votes, status, margin: 5 });

describe('useLivePulse', () => {
  it('a lead change pulses its seat for RECENT_CHANGE_MS and adds a ticker line; the first snapshot is the baseline', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ results, version }) => useLivePulse('e', results, version, null),
      { initialProps: { results: [row('S1', 'BJP')], version: 1 as number | null } });
    expect(result.current.recentSeats.size).toBe(0);
    rerender({ results: [row('S1', 'INC')], version: 2 });
    expect(result.current.recentSeats.get('S1')).toBe('switch');
    expect(result.current.ticker[0]).toMatchObject({ constId: 'S1', kind: 'switch' });
    act(() => { vi.advanceTimersByTime(RECENT_CHANGE_MS + 10); });
    expect(result.current.recentSeats.size).toBe(0);
  });
});

describe('LivePulseProvider', () => {
  it('a pulse change does not re-render a component that reads only the dashboard sources', () => {
    const sources = makeSources();
    let sourceRenders = 0, pulseRenders = 0;
    const SourcesReader = memo(function SourcesReader() { useSources(); sourceRenders++; return null; });
    const PulseReader = memo(function PulseReader() { useLivePulseState(); pulseRenders++; return null; });
    const tree = (pulse: { ticker: never[]; recentSeats: Map<string, 'switch'> }) => (
      <DashboardSourcesProvider value={sources}><LivePulseProvider value={pulse}><SourcesReader /><PulseReader /></LivePulseProvider></DashboardSourcesProvider>);
    const { rerender } = render(tree({ ticker: [], recentSeats: new Map() }));
    rerender(tree({ ticker: [], recentSeats: new Map([['S1', 'switch']]) }));
    expect(pulseRenders).toBe(2);
    expect(sourceRenders).toBe(1);
  });
  it('without a provider the pulse is empty (tiles and tests outside the dashboard)', () => {
    const { result } = renderHook(() => useLivePulseState());
    expect(result.current.recentSeats.size).toBe(0);
    expect(result.current.ticker).toEqual([]);
  });
});
