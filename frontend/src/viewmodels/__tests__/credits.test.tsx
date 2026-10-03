// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as api from '../../model/api/credits.service';
import { useCreditsVM } from '../about/useCreditsVM';

describe('useCreditsVM', () => {
  it('loads the credits list', async () => {
    vi.spyOn(api, 'getCredits').mockResolvedValue([{ url: 'u', source_url: 's', author: 'A', licence: 'CC BY 4.0', used_by: 'X' }]);
    const { result } = renderHook(() => useCreditsVM());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.credits).toHaveLength(1);
  });
  it('shows an empty list when the request fails', async () => {
    vi.spyOn(api, 'getCredits').mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useCreditsVM());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.credits).toEqual([]);
  });
});
