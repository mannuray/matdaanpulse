// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

const data = vi.hoisted(() => {
  const seat = (id: string, const_no: number, election_id: string) => ({ id, election_id, name: id, const_no, type: 'GEN', state_id: 1, district_id: null, region_id: null, voter_turnout: null, metadata: {} });
  const cand = (id: string, name: string, const_id: string, person_id: string | null = null, party_id = 'BJP') => ({
    id, person_id, election_id: 'e1', const_id, party_id, party: null, name, is_incumbent: false, metadata: {},
  });
  return {
    seats: { e1: [seat('s142', 142, 'e1'), seat('s1', 1, 'e1')], e2: [seat('k5', 5, 'e2')] } as Record<string, unknown[]>,
    cands: { s1: [cand('c1', 'Ravi Prasad', 's1', 'p1'), cand('c2', 'Anil Kumar', 's1'), cand('n', 'NOTA', 's1', null, 'NOTA')] } as Record<string, unknown[]>,
  };
});
vi.mock('../services/constituency.service', () => ({ getConstituencies: vi.fn(async (eid: string) => data.seats[eid] ?? []) }));
vi.mock('../services/candidate.service', () => ({
  getCandidates: vi.fn(async (_eid: string, cid: string) => data.cands[cid] ?? []),
  searchCandidates: vi.fn(async () => []),
  linkCandidatePerson: vi.fn(async () => ({})),
  unlinkCandidatePerson: vi.fn(async () => ({})),
}));
vi.mock('../services/person.api', () => ({ createPerson: vi.fn(async () => ({ id: 'p9' })) }));
import { useCandidateManager } from './useCandidateManager';
import { getCandidates } from '../services/candidate.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('useCandidateManager', () => {
  it('defaults to the lowest seat number, hides NOTA, and never writes per-page election keys', async () => {
    const { result } = renderHook(() => useCandidateManager('e1'), { wrapper });
    await waitFor(() => expect(result.current.selectedConst).toBe('s1'));
    await waitFor(() => expect(result.current.candidates.map((c) => c.id)).toEqual(['c1', 'c2']));
    expect(result.current.constituencies.map((c) => c.const_no)).toEqual([1, 142]);
    expect(getCandidates).not.toHaveBeenCalledWith('e1', '');
    expect(localStorage.getItem('admin_cand_election')).toBeNull();
    expect(localStorage.getItem('admin_cand_const')).toBeNull();
  });

  it('chips and the name search filter the seat; counts stay per seat', async () => {
    const { result } = renderHook(() => useCandidateManager('e1'), { wrapper });
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(result.current.counts).toEqual({ all: 2, linked: 1, unlinked: 1 });
    act(() => result.current.setPersonFilter('unlinked'));
    expect(result.current.candidates.map((c) => c.id)).toEqual(['c2']);
    act(() => { result.current.setPersonFilter('all'); result.current.setSearch('ravi'); });
    expect(result.current.candidates.map((c) => c.id)).toEqual(['c1']);
  });

  it('switching election resets the seat to that election\'s first seat', async () => {
    const { result, rerender } = renderHook(({ eid }) => useCandidateManager(eid), { wrapper, initialProps: { eid: 'e1' } });
    await waitFor(() => expect(result.current.selectedConst).toBe('s1'));
    rerender({ eid: 'e2' });
    await waitFor(() => expect(result.current.selectedConst).toBe('k5'));
    expect(getCandidates).not.toHaveBeenCalledWith('e2', 's1');
  });
});
