// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/constituency.service', () => ({
  getAdminConstituencyDetail: vi.fn(async () => ({
    id: 'BR_VS2025_PATNA', election_id: 'e1', name: 'Patna Sahib', const_no: 142, type: 'GEN', state_id: 1,
    district_id: null, region_id: null, voter_turnout: null,
    metadata: { population: 0, literacy_pct: 61.2, tags: ['urban'], phase: 2, source: 'census' },
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
    expect(result.current.adminInfo.phase).toBe('2');
  });

  it('saves 0 as 0, empty as null, and keeps other metadata', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.setEditDemographics({ ...result.current.editDemographics, literacy_pct: '0', urban_pct: '' }));
    await act(() => result.current.handleSave());
    expect(updateConstituency).toHaveBeenCalledWith('BR_VS2025_PATNA', expect.objectContaining({
      const_no: 142,
      metadata: expect.objectContaining({ population: 0, literacy_pct: 0, urban_pct: null, source: 'census', tags: ['urban'] }),
    }));
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
});
