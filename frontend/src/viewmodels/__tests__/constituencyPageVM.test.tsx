// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = {
  getElection: vi.fn(), getConstituency: vi.fn(), getConstituencyAnalysis: vi.fn(), getManifest: vi.fn(),
  getGeoJSON: vi.fn().mockResolvedValue({ type: 'FeatureCollection', features: [] }),
};
vi.mock('../../model/api/election.service', async (orig) => ({
  ...(await orig<typeof import('../../model/api/election.service')>()),
  getElection: (...a: unknown[]) => api.getElection(...a), getConstituency: (...a: unknown[]) => api.getConstituency(...a),
  getConstituencyAnalysis: (...a: unknown[]) => api.getConstituencyAnalysis(...a), getManifest: (...a: unknown[]) => api.getManifest(...a),
  ElectionService: { getCacheKey: (id: string, s?: string) => `e_${id}_${s}`, getConstituencyCacheKey: (e: string, c: string) => `c_${e}_${c}`, getGeoJSON: (u: string) => api.getGeoJSON(u) },
}));
vi.mock('../data/useLiveSnapshot', () => ({ useLiveSnapshot: () => ({ snapshot: null, connected: false, status: null, error: null, pollNow: () => {} }) }));
vi.mock('../data/usePartyMeta', () => ({ usePartyMeta: () => new Map() }));

import { useConstituencyPageVM } from '../pages/useConstituencyPageVM';
import { ApiError } from '../../model/api/api-client';

const detail = {
  id: 'S', election_id: 'e1', name: 'Patliputra', const_no: 30, type: 'SC', voter_turnout: 59.4, phase: 7, total_electors: 2000,
  current_round: null, total_rounds: null, last_updated: null, state: { id: 4, name: 'Bihar' }, district: { id: 1, name: 'Patna' }, region: { id: 2, name: 'Magadh' },
  candidates: [
    { id: 'n', name: 'NOTA', party: null, is_incumbent: false, votes: 20, status: 'LOST', margin: 0, person_id: 'pn', person: null },
    { id: 'a', name: 'A', party: { id: 'BJP', name: 'BJP', color: '#f80', symbol_url: null, eci_symbol_url: null }, is_incumbent: true, votes: 600, status: 'WON', margin: 220, person_id: 'p1', person: { id: 'p1', photo_url: null }, age: 64, assets: 1, liabilities: 0, criminal_cases: 0 },
    { id: 'b', name: 'B', party: { id: 'RJD', name: 'RJD', color: '#0a0', symbol_url: null, eci_symbol_url: null }, is_incumbent: false, votes: 380, status: 'LOST', margin: 0, person_id: 'p2', person: null },
  ],
};

describe('useConstituencyPageVM', () => {
  it('builds facts, the full ranked table with NOTA last, and history', async () => {
    api.getElection.mockResolvedValue({ id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', status: 'Finalized', year: 2025 });
    api.getConstituency.mockResolvedValue(detail);
    api.getConstituencyAnalysis.mockResolvedValue({ dominance: 'swing', incumbency: { seat_history: [{ year: 2020, party: 'BJP', candidate: 'A', margin: 5 }] } });
    api.getManifest.mockResolvedValue(null);
    const { result } = renderHook(() => useConstituencyPageVM('e1', 'S'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.view.candidates.map(c => c.name)).toEqual(['A', 'B', 'NOTA']);
    expect(result.current.facts).toMatchObject({ electors: 2000, votesPolled: 1000, turnout: 59.4, phase: 7, region: 'Magadh', district: 'Patna', progress: null });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.dominance).toBe('swing');
    expect(result.current.live).toEqual({ kind: 'declared' });
  });

  it('reports notFound on a 404', async () => {
    api.getElection.mockResolvedValue({ id: 'e1', name: 'x', type: 'VS', status: 'Finalized', year: 2025 });
    api.getConstituency.mockRejectedValue(new ApiError('Not found', 404));
    api.getConstituencyAnalysis.mockResolvedValue(null);
    api.getManifest.mockResolvedValue(null);
    const { result } = renderHook(() => useConstituencyPageVM('e1', 'NOPE'));
    await waitFor(() => expect(result.current.status).toBe('notFound'));
  });
});
