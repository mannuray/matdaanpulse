// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { makeSources } from './fixtures';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';

const getConstituency = vi.fn();
const getConstituencyAnalysis = vi.fn();
vi.mock('../../model/api/election.service', async (orig) => ({
  ...(await orig<typeof import('../../model/api/election.service')>()),
  getConstituency: (...a: unknown[]) => getConstituency(...a),
  getConstituencyAnalysis: (...a: unknown[]) => getConstituencyAnalysis(...a),
}));

import { useSeatDialogVM } from '../tiles/useSeatDialogVM';

function wrap(url: string, sources = makeSources()) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      <DashboardSourcesProvider value={sources}>
        <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider>
      </DashboardSourcesProvider>
    </MemoryRouter>
  );
}

describe('useSeatDialogVM', () => {
  it('is null without a selected seat', () => {
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/') });
    expect(result.current).toBeNull();
  });

  it('shows live rows at once and the facts once the detail arrives', async () => {
    getConstituency.mockResolvedValue({ id: 'BR_VS_1_SANDESH', name: 'Sandesh', const_no: 1, type: 'SC', total_electors: 2000, voter_turnout: 59.4, phase: 1,
      current_round: null, total_rounds: null, last_updated: null, state: { id: 4, name: 'Bihar' }, district: { id: 1, name: 'Bhojpur' }, candidates: [] });
    getConstituencyAnalysis.mockResolvedValue(null);
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    expect(result.current?.view.candidates.map(c => c.name)).toEqual(['RADHA CHARAN SAH', 'R']);
    expect(result.current?.detailState).toBe('loading');
    await waitFor(() => expect(result.current?.detailState).toBe('ready'));
    expect(result.current).toMatchObject({ name: 'Sandesh', type: 'SC', place: 'Bhojpur · Bihar', electors: 2000, turnout: 59.4, phase: 1, live: { kind: 'declared' } });
  });

  it('a failed detail keeps the live rows and reports error', async () => {
    getConstituency.mockRejectedValue(new Error('boom'));
    getConstituencyAnalysis.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    await waitFor(() => expect(result.current?.detailState).toBe('error'));
    expect(result.current?.view.candidates).toHaveLength(2);
  });

  it('opening a party from the dialog selects it in the store', () => {
    getConstituency.mockResolvedValue(null);
    getConstituencyAnalysis.mockResolvedValue(null);
    const { result } = renderHook(() => ({ vm: useSeatDialogVM(), store: useDashboardStore() }), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    act(() => result.current.vm!.onOpenParty('JDU'));
    expect(result.current.store.state.selectedParty).toBe('JDU');
  });
});
