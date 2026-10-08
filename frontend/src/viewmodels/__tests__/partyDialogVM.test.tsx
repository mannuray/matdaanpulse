// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { makeSources } from './fixtures';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';

const getParty = vi.fn();
vi.mock('../../model/api/geo.service', async (orig) => ({ ...(await orig<typeof import('../../model/api/geo.service')>()), getParty: (...a: unknown[]) => getParty(...a) }));

const getConstituency = vi.fn();
vi.mock('../../model/api/election.service', async (orig) => ({ ...(await orig<typeof import('../../model/api/election.service')>()), getConstituency: (...a: unknown[]) => getConstituency(...a) }));

import { usePartyDialogVM } from '../tiles/usePartyDialogVM';

const wrap = (url: string, over: Parameters<typeof makeSources>[0] = {}) => ({ children }: { children: ReactNode }) => {
  const s = makeSources(over);
  return <MemoryRouter initialEntries={[url]}><DashboardSourcesProvider value={s}><DashboardStoreProvider allowedLayers={s.availableLayers} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider></DashboardSourcesProvider></MemoryRouter>;
};

describe('usePartyDialogVM', () => {
  beforeEach(() => { getConstituency.mockReset(); getConstituency.mockResolvedValue(null); });
  it('combines meta, this election and the profile', async () => {
    getParty.mockResolvedValue({ id: 'JDU', name: 'Janata Dal (United)', leader_name: 'Nitish Kumar', founded_year: 2003, headquarters: null, website: null, wikipedia_url: null, description: null });
    const { result } = renderHook(() => usePartyDialogVM(), { wrapper: wrap('/?party=JDU') });
    expect(result.current?.pageHref).toBe('/party/JDU?state=BR');
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

  it('key candidates: all this party\'s leaders first (a seatless one with no status)', () => {
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
    const cards = result.current!.keyCandidates;
    expect(cards.slice(0, 4).map(c => [c.name, c.status, c.leader])).toEqual([['Winner', 'WON', true], ['Pending', 'PENDING', true], ['Seatless', null, true], ['Loser', 'LOST', true]]);
    // Room left (up to 8): the party's other wins follow, without repeating a leader's seat.
    expect(cards.slice(4).every(c => !c.leader && c.constId !== 'BR_VS_1_SANDESH')).toBe(true);
  });

  it('key candidates: without manifest leaders the party\'s biggest wins fill the cards', () => {
    getParty.mockResolvedValue(null);
    const base = makeSources();
    const manifestData = { ...base.data.manifestData!, leaders: [] };
    const { result } = renderHook(() => usePartyDialogVM(), { wrapper: wrap('/?party=JDU', { data: { ...base.data, manifestData } as never }) });
    expect(result.current!.keyCandidates.map(c => [c.name, c.leader])).toEqual([['KALADHAR PRASAD MANDAL', false], ['RADHA CHARAN SAH', false]]);
  });

  it('key candidates: photo from the seat detail (the party\'s candidate there, whatever the ballot name)', async () => {
    getParty.mockResolvedValue(null);
    getConstituency.mockImplementation(async (_e: string, id: string) => ({ id, candidates: [
      { name: 'SOMEONE ELSE', party: { id: 'BJP' }, person: { id: 'x', photo_url: '/bjp.png' } },
      { name: 'ANY BALLOT NAME', party: { id: 'JDU' }, person: { id: 'y', photo_url: `/${id}.png` } },
    ] }));
    const base = makeSources();
    const manifestData = { ...base.data.manifestData!, leaders: [] };
    const { result } = renderHook(() => usePartyDialogVM(), { wrapper: wrap('/?party=JDU', { data: { ...base.data, manifestData } as never }) });
    await waitFor(() => expect(result.current!.keyCandidates.every(c => c.photo === `/${c.constId}.png`)).toBe(true));
  });

  it('key candidates: track toggles the seat on the watchlist', () => {
    getParty.mockResolvedValue(null);
    getConstituency.mockResolvedValue(null);
    const addWatch = vi.fn(), removeWatch = vi.fn();
    const base = makeSources();
    const manifestData = { ...base.data.manifestData!, leaders: [] };
    const { result } = renderHook(() => usePartyDialogVM(), { wrapper: wrap('/?party=JDU', { data: { ...base.data, manifestData } as never, watchlist: [{ const_id: 'BR_VS_1_SANDESH', label: 'Sandesh' }], addWatch, removeWatch }) });
    const [a, b] = result.current!.keyCandidates;
    const tracked = [a, b].find(c => c.constId === 'BR_VS_1_SANDESH')!, other = [a, b].find(c => c !== tracked)!;
    expect(tracked.tracked).toBe(true);
    expect(other.tracked).toBe(false);
    act(() => result.current!.onToggleTrack(tracked.constId, 'Sandesh'));
    expect(removeWatch).toHaveBeenCalledWith('BR_VS_1_SANDESH');
    act(() => result.current!.onToggleTrack(other.constId, 'X'));
    expect(addWatch).toHaveBeenCalledWith(other.constId, 'X');
  });
});
