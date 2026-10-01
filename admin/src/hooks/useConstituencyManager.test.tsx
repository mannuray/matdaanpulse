// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

const data = vi.hoisted(() => {
  const C = (id: string, no: number, district: string, tags: string[] = []) => ({
    id, election_id: 'e1', name: id, const_no: no, type: 'GEN', state_id: 1, district_id: 1,
    district: { id: 1, name: district, code: 'x' }, region_id: null, region: null, voter_turnout: null, metadata: { tags },
  });
  return { page1: [C('a', 1, 'Patna'), C('b', 2, 'Patna', ['urban']), C('c', 3, 'Gaya')], page2: [C('z', 101, 'Gaya')] };
});
vi.mock('../services/constituency.service', () => ({
  getAdminConstituencies: vi.fn(async (_e: string, page: number) => ({
    success: true, data: page === 1 ? data.page1 : data.page2, pagination: { page, limit: 100, total: 243, totalPages: 3 },
  })),
  bulkTagConstituencies: vi.fn(async () => []),
  computeConstituencyAnalysis: vi.fn(async () => ({ computed: 0 })),
}));
import { useConstituencyManager } from './useConstituencyManager';
import { getAdminConstituencies, bulkTagConstituencies } from '../services/constituency.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('useConstituencyManager', () => {
  it('pages, and a new search goes back to page 1', async () => {
    const { result } = renderHook(() => useConstituencyManager('e1'), { wrapper });
    await waitFor(() => expect(result.current.constituencies).toHaveLength(3));
    expect(result.current.totalPages).toBe(3);
    act(() => result.current.loadPage(2));
    await waitFor(() => expect(getAdminConstituencies).toHaveBeenLastCalledWith('e1', 2, 100, undefined));
    act(() => result.current.setSearch('pat'));
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(getAdminConstituencies).toHaveBeenLastCalledWith('e1', 1, 100, 'pat'));
  });

  it('select all and bulk tag act on the visible rows only; a filter change clears the selection', async () => {
    const { result } = renderHook(() => useConstituencyManager('e1'), { wrapper });
    await waitFor(() => expect(result.current.constituencies).toHaveLength(3));
    act(() => result.current.setDistrictFilter('Patna'));
    expect(result.current.constituencies.map((c) => c.id)).toEqual(['a', 'b']);
    act(() => result.current.selection.selectAll());
    expect([...result.current.selection.selectedIds]).toEqual(['a', 'b']);
    await act(() => result.current.bulkAddTag('rural'));
    expect(bulkTagConstituencies).toHaveBeenCalledWith(['a', 'b'], ['rural'], []);
    act(() => result.current.selection.selectAll());
    act(() => result.current.setDistrictFilter('Gaya'));
    expect(result.current.selection.count).toBe(0);
  });

  it('switching election starts again at page 1', async () => {
    const { result, rerender } = renderHook(({ eid }) => useConstituencyManager(eid), { wrapper, initialProps: { eid: 'e1' } });
    await waitFor(() => expect(result.current.constituencies).toHaveLength(3));
    act(() => result.current.loadPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));
    rerender({ eid: 'e2' });
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(getAdminConstituencies).toHaveBeenLastCalledWith('e2', 1, 100, undefined));
    expect(getAdminConstituencies).not.toHaveBeenCalledWith('e2', 3, 100, undefined);
  });
});
