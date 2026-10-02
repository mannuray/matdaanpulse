// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/constituency.service', () => ({
  getAdminConstituencyDetail: vi.fn(async () => ({
    id: 'BR_VS2025_PATNA', election_id: 'e1', name: 'Patna Sahib', const_no: 142, type: 'GEN', state_id: 1,
    district_id: 7, region_id: 3, voter_turnout: null, phase: 2,
    metadata: { population: 0, literacy_pct: 61.2, urban_pct: 40, dominant_castes: 'Yadav', tags: ['urban'], phase: 9, source: 'census' },
  })),
  updateConstituency: vi.fn(async () => ({})),
}));
vi.mock('../services/geo.service', () => ({ getDistricts: vi.fn(async () => []), getRegions: vi.fn(async () => []) }));
import { useConstituencyEditor } from './useConstituencyEditor';
import { updateConstituency } from '../services/constituency.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

describe('useConstituencyEditor numbers', () => {
  it('shows a stored 0 as "0"', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    expect(result.current.editDemographics.population).toBe('0');
    // The phase column is canonical; a stale metadata.phase is ignored.
    expect(result.current.adminInfo.phase).toBe('2');
    expect(result.current.adminInfo.type).toBe('GEN');
  });

  it('phase saves to the column (a number, or null when cleared) and never into metadata', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.setAdminInfo({ ...result.current.adminInfo, phase: '4' }));
    await act(() => result.current.handleSave());
    const body = (updateConstituency as any).mock.calls[0][1];
    expect(body.phase).toBe(4);
    expect(body.metadata).not.toHaveProperty('phase');
    act(() => result.current.setAdminInfo({ ...result.current.adminInfo, phase: '' }));
    await act(() => result.current.handleSave());
    expect((updateConstituency as any).mock.calls[1][1].phase).toBeNull();
  });

  it('reservation saves type; untouched phase and type are not sent', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.setAdminInfo({ ...result.current.adminInfo, type: 'SC' }));
    await act(() => result.current.handleSave());
    const body = (updateConstituency as any).mock.calls[0][1];
    expect(body.type).toBe('SC');
    expect(body).not.toHaveProperty('phase');
  });

  it('saves 0 as 0, empty as null, and sends only the changed keys (the server merges metadata)', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.setEditDemographics({ ...result.current.editDemographics, literacy_pct: '0', urban_pct: '' }));
    await act(() => result.current.handleSave());
    expect(updateConstituency).toHaveBeenCalledWith('BR_VS2025_PATNA', expect.objectContaining({
      const_no: 142, district_id: 7, region_id: 3,
      metadata: { literacy_pct: 0, urban_pct: null },
    }));
    // Tags were not edited, so they are not sent (a bulk tag added meanwhile must survive).
    expect((updateConstituency as any).mock.calls[0][1].metadata).not.toHaveProperty('tags');
  });

  it('an invalid seat number is reported on the field and nothing is sent', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.setAdminInfo({ ...result.current.adminInfo, const_no: 'abc' }));
    let ok = true;
    await act(async () => { ok = await result.current.handleSave(); });
    expect(ok).toBe(false);
    expect(result.current.fieldErrors.const_no).toBe('Enter a whole number, 1 or more');
    expect(updateConstituency).not.toHaveBeenCalled();
  });

  it('sends tags only when edited, and never resends an unedited legacy value', async () => {
    const svc = await import('../services/constituency.service');
    (svc.getAdminConstituencyDetail as any).mockResolvedValueOnce({
      id: 'x', election_id: 'e1', name: 'X', const_no: 1, type: 'GEN', state_id: 1, district_id: null, region_id: null,
      metadata: { literacy_pct: '62.3%', tags: ['urban'] },
    });
    const { result } = renderHook(() => useConstituencyEditor('x'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.setEditDemographics({ ...result.current.editDemographics, religions: 'Hindu' }));
    await act(() => result.current.handleSave());
    const meta = (updateConstituency as any).mock.calls[0][1].metadata;
    expect(meta).toEqual({ religions: 'Hindu' });
  });

  it('choosing the original district again is not an edit', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.setAdminInfo({ ...result.current.adminInfo, district_id: '8' }));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.setAdminInfo({ ...result.current.adminInfo, district_id: '7' }));
    expect(result.current.isDirty).toBe(false);
  });

  it('edited tags are the server tags plus added minus removed, so a bulk tag added meanwhile survives', async () => {
    const svc = await import('../services/constituency.service');
    const detail = (tags: string[]) => ({
      id: 'x', election_id: 'e1', name: 'X', const_no: 1, type: 'GEN', state_id: 1, district_id: null, region_id: null,
      metadata: { tags, source: 'census' },
    });
    (svc.getAdminConstituencyDetail as any).mockResolvedValueOnce(detail(['urban', 'sc']));
    const { result } = renderHook(() => useConstituencyEditor('x'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.removeTag('urban'));
    act(() => result.current.addTag('reserved'));
    // Meanwhile a bulk tag added "border" on the server.
    (svc.getAdminConstituencyDetail as any).mockResolvedValueOnce(detail(['urban', 'sc', 'border']));
    await act(() => result.current.handleSave());
    expect((updateConstituency as any).mock.calls[0][1].metadata).toEqual({ tags: ['sc', 'border', 'reserved'] });
  });
});
