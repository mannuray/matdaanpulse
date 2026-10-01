// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/geo.service', () => ({
  getParty: vi.fn(async () => ({
    id: 'BJP', name: 'Bharatiya Janata Party', color: '#f59e0b', symbol_url: null, eci_symbol_url: null, abbreviation: 'BJP',
    leader_name: null, founded_year: 1980, headquarters: null, website: null, wikipedia_url: null, description: null,
  })),
  updateParty: vi.fn(async () => ({})),
}));
import { usePartyEdit } from './usePartyEdit';
import { updateParty } from '../services/geo.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

describe('usePartyEdit', () => {
  it('starts loading, is clean after load, dirty after an edit, clean again after reset', async () => {
    const { result } = renderHook(() => usePartyEdit('BJP'), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.party?.id).toBe('BJP'));
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setForm({ ...result.current.form, leader_name: 'J P Nadda' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
    expect(result.current.form.leader_name).toBe('');
  });

  it('saves the form with founded_year as a number', async () => {
    const { result } = renderHook(() => usePartyEdit('BJP'), { wrapper });
    await waitFor(() => expect(result.current.party).not.toBeNull());
    act(() => result.current.setForm({ ...result.current.form, founded_year: '1981' }));
    await act(() => result.current.handleSave());
    expect(updateParty).toHaveBeenCalledWith('BJP', expect.objectContaining({ founded_year: 1981, name: 'Bharatiya Janata Party' }));
  });
});
