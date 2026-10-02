// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { makeSources } from './fixtures';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';

const getParty = vi.fn();
vi.mock('../../model/api/geo.service', async (orig) => ({ ...(await orig<typeof import('../../model/api/geo.service')>()), getParty: (...a: unknown[]) => getParty(...a) }));

import { usePartyDialogVM } from '../tiles/usePartyDialogVM';

const wrap = (url: string, over: Parameters<typeof makeSources>[0] = {}) => ({ children }: { children: ReactNode }) => {
  const s = makeSources(over);
  return <MemoryRouter initialEntries={[url]}><DashboardSourcesProvider value={s}><DashboardStoreProvider allowedLayers={s.availableLayers} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider></DashboardSourcesProvider></MemoryRouter>;
};

describe('usePartyDialogVM', () => {
  it('combines meta, this election and the profile', async () => {
    getParty.mockResolvedValue({ id: 'JDU', name: 'Janata Dal (United)', leader_name: 'Nitish Kumar', founded_year: 2003, headquarters: null, website: null, wikipedia_url: null, description: null });
    const { result } = renderHook(() => usePartyDialogVM(), { wrapper: wrap('/?party=JDU') });
    expect(result.current).toMatchObject({ id: 'JDU', abbreviation: 'JD(U)', stats: { won: 2, contested: 2, alliance: { id: 'NDA' } }, totalSeats: 243, majority: 122 });
    await waitFor(() => expect(result.current?.profile?.leader).toBe('Nitish Kumar'));
    expect(result.current?.profile).toMatchObject({ founded: 2003, hq: null });
  });

  it('picking a key candidate closes the party and opens the seat', () => {
    getParty.mockResolvedValue(null);
    const { result } = renderHook(() => ({ vm: usePartyDialogVM(), s: useDashboardStore() }), { wrapper: wrap('/?party=JDU') });
    act(() => result.current.vm!.onSelectSeat('BR_VS_1_SANDESH'));
    expect(result.current.s.state).toMatchObject({ selectedParty: null, selectedSeat: 'BR_VS_1_SANDESH' });
  });

  it('an id unknown to the party list and to the results opens nothing; a result-only party still opens', () => {
    getParty.mockResolvedValue(null);
    const { result: none } = renderHook(() => usePartyDialogVM(), { wrapper: wrap('/?party=ZZZ') });
    expect(none.current).toBeNull();
    const { result: resultOnly } = renderHook(() => usePartyDialogVM(), { wrapper: wrap('/?party=RJD') });
    expect(resultOnly.current).toMatchObject({ id: 'RJD', name: 'Rashtriya Janata Dal', stats: { contested: 1 } });
  });

  it('key candidates: only this party\'s leaders who won or lead a seat', () => {
    getParty.mockResolvedValue(null);
    const base = makeSources();
    const manifestData = { ...base.data.manifestData!, leaders: [
      { name: 'Winner', party_id: 'JDU', const_id: 'BR_VS_1_SANDESH' },
      { name: 'Pending', party_id: 'JDU', const_id: 'BR_VS_99_NOWHERE' },
      { name: 'Seatless', party_id: 'JDU', const_id: '' },
      { name: 'Loser', party_id: 'JDU', const_id: 'BR_VS_3_AGIAON' },
      { name: 'Other party', party_id: 'BJP', const_id: 'BR_VS_3_AGIAON' },
    ] };
    const { result } = renderHook(() => usePartyDialogVM(), { wrapper: wrap('/?party=JDU', { data: { ...base.data, manifestData } as never }) });
    expect(result.current!.keyCandidates.map(c => [c.name, c.status])).toEqual([['Winner', 'WON']]);
  });
});
