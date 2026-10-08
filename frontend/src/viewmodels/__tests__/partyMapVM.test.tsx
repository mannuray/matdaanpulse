// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const api = { getManifest: vi.fn(), getResults: vi.fn(), getGeoJSON: vi.fn() };
vi.mock('../../model/api/election.service', () => ({
  getManifest: (...a: unknown[]) => api.getManifest(...a), getResults: (...a: unknown[]) => api.getResults(...a),
  ElectionService: { getGeoJSON: (...a: unknown[]) => api.getGeoJSON(...a) },
}));

import { usePartyMap } from '../pages/usePartyMap';

const feature = (no: number, name: string) => ({ type: 'Feature', properties: { ac_no: no, ac_name: name, st_name: 'Jharkhand' }, geometry: { type: 'Polygon', coordinates: [[[85, 23], [86, 23], [86, 24], [85, 23]]] } });

describe('usePartyMap', () => {
  it('loads the election map and results, colours seats, and refetches when another year is picked', async () => {
    api.getManifest.mockImplementation((id: string) => Promise.resolve({ election_id: id, manifest_url: null, draft: { geo: { map_url: `/geo/${id}.geojson` } } }));
    api.getGeoJSON.mockResolvedValue({ type: 'FeatureCollection', features: [feature(1, 'Rajmahal'), feature(2, 'Borio')] });
    api.getResults.mockImplementation((id: string) => Promise.resolve(id === 'e24'
      ? [{ const_id: 'JH_VS24_1_RAJMAHAL', party_id: 'BJP', candidate_name: 'a', votes: 1, status: 'WON', margin: 1 }, { const_id: 'JH_VS24_2_BORIO', party_id: 'JMM', candidate_name: 'b', votes: 1, status: 'WON', margin: 1 }]
      : [{ const_id: 'JH_VS19_1_RAJMAHAL', party_id: 'JMM', candidate_name: 'a', votes: 1, status: 'WON', margin: 1 }]));
    const years = [{ electionId: 'e24', year: 2024 }, { electionId: 'e19', year: 2019 }];
    const { result } = renderHook(() => usePartyMap('BJP', '#f80', years));
    await waitFor(() => expect(result.current?.status).toBe('ready'));
    const m = result.current!;
    expect(m.electionId).toBe('e24');
    expect(m.features).toHaveLength(2);
    const ids = m.features.map(f => m.seatOf.get(f));
    expect(ids).toEqual(['JH_VS24_1_RAJMAHAL', 'JH_VS24_2_BORIO']);
    expect(m.fills.get('JH_VS24_1_RAJMAHAL')?.result).toBe('won');
    act(() => m.setElection('e19'));
    await waitFor(() => expect(result.current?.electionId).toBe('e19'));
    await waitFor(() => expect(api.getResults).toHaveBeenCalledWith('e19'));
  });
  it('switching to a year on the same map file stays loading until that year\'s results arrive (no old colours)', async () => {
    api.getManifest.mockImplementation((id: string) => Promise.resolve({ election_id: id, manifest_url: null, draft: { geo: { map_url: '/geo/same.geojson' } } }));
    api.getGeoJSON.mockResolvedValue({ type: 'FeatureCollection', features: [feature(1, 'Rajmahal')] });
    let release: (rows: unknown[]) => void = () => {};
    api.getResults.mockImplementation((id: string) => (id === 'x24'
      ? Promise.resolve([{ const_id: 'JH_VS24_1_RAJMAHAL', party_id: 'BJP', candidate_name: 'a', votes: 1, status: 'WON', margin: 1 }])
      : new Promise(r => { release = r; })));
    const { result } = renderHook(() => usePartyMap('BJP', '#f80', [{ electionId: 'x24', year: 2024 }, { electionId: 'x19', year: 2019 }]));
    await waitFor(() => expect(result.current?.status).toBe('ready'));
    act(() => result.current!.setElection('x19'));
    await waitFor(() => expect(result.current?.electionId).toBe('x19'));
    expect(result.current?.status).toBe('loading');
    act(() => release([{ const_id: 'JH_VS19_1_RAJMAHAL', party_id: 'JMM', candidate_name: 'a', votes: 1, status: 'WON', margin: 1 }]));
    await waitFor(() => expect(result.current?.status).toBe('ready'));
    expect(result.current?.fills.get('JH_VS19_1_RAJMAHAL')?.result).toBe('none');
  });
  it('no elections → null', () => {
    const { result } = renderHook(() => usePartyMap('BJP', '#f80', []));
    expect(result.current).toBeNull();
  });
});
