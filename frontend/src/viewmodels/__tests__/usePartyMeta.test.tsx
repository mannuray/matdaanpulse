// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../model/api/geo.service', () => ({
  getParties: vi.fn().mockResolvedValue([{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#f80', abbreviation: 'BJP', symbol_url: '/l.svg', eci_symbol_url: null }]),
}));

import { usePartyMeta } from '../data/usePartyMeta';

describe('usePartyMeta', () => {
  it('starts empty and fills from /parties', async () => {
    const { result } = renderHook(() => usePartyMeta());
    expect(result.current.size).toBe(0);
    await waitFor(() => expect(result.current.get('BJP')?.mark).toBe('/l.svg'));
  });
});
