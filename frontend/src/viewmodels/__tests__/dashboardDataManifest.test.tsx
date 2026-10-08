// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getManifest: vi.fn(),
}));
vi.mock('../../model/api/election.service', async (orig) => ({
  ...(await orig<typeof import('../../model/api/election.service')>()),
  getAlliances: vi.fn(async () => []),
  getVoteShare: vi.fn(async () => []),
  getResults: vi.fn(async () => []),
  getManifest: (...a: unknown[]) => api.getManifest(...a),
}));
vi.mock('../data/useLiveSnapshot', () => ({ useLiveSnapshot: () => ({ snapshot: null, connected: false, status: null, error: null, pollNow: () => undefined }) }));
import { useDashboardData } from '../data/useDashboardData';
import type { Election } from '../../model/types';

const election = { id: 'e-man-1', name: 'Bihar 2025', type: 'VS', status: 'Finalized', year: 2025, state_id: 1 } as unknown as Election;

beforeEach(() => { api.getManifest.mockReset(); });

describe('useDashboardData: manifestLoaded (the map waits for it)', () => {
  it('false while the manifest request is in flight, true once it answers', async () => {
    let resolve!: (v: unknown) => void;
    api.getManifest.mockReturnValue(new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useDashboardData(election));
    expect(result.current.manifestLoaded).toBe(false);
    resolve({ election_id: election.id, draft: { geo: { map_url: '/geo/bihar_ac_2008.geojson' } } });
    await waitFor(() => expect(result.current.manifestLoaded).toBe(true));
    expect(result.current.manifestData?.geo?.map_url).toBe('/geo/bihar_ac_2008.geojson');
  });

  it('a failed manifest request also counts as loaded (the map then says unavailable instead of spinning)', async () => {
    api.getManifest.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useDashboardData({ ...election, id: 'e-man-2' } as Election));
    await waitFor(() => expect(result.current.manifestLoaded).toBe(true));
  });
});
