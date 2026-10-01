// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';
import type { Election } from '../types';

vi.mock('../services/election.service', () => ({
  getElections: vi.fn(async () => []),
  createElection: vi.fn(async () => ({ id: 'e9' })),
  updateElection: vi.fn(async () => ({})),
  finalizeElection: vi.fn(async () => ({})),
}));
vi.mock('../services/geo.service', () => ({ getStates: vi.fn(async () => []) }));
import { useElectionManager, isValidElectionYear } from './useElectionManager';
import { createElection, updateElection } from '../services/election.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

const bihar: Election = { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', state_id: 10, year: 2025, status: 'Upcoming', tentative_next_date: '2030-10-01T00:00:00.000Z', manifest_url: null };

describe('useElectionManager', () => {
  it('startEdit is clean, an edit is dirty, revert is clean again; dates fit the date input', () => {
    const { result } = renderHook(() => useElectionManager(), { wrapper });
    act(() => result.current.startEdit(bihar));
    expect(result.current.dirty).toBe(false);
    expect(result.current.form.tentative_next_date).toBe('2030-10-01');
    act(() => result.current.setForm({ ...result.current.form, year: '2026' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.revert());
    expect(result.current.dirty).toBe(false);
  });

  it('create resolves to the new id only after onChanged has finished', async () => {
    const order: string[] = [];
    const onChanged = vi.fn(async () => { order.push('reload'); });
    const { result } = renderHook(() => useElectionManager({ onChanged }), { wrapper });
    act(() => result.current.startCreate());
    act(() => result.current.setForm({ ...result.current.form, name: 'Kerala Vidhan Sabha 2026', type: 'VS', state_id: '32' }));
    let id: string | null = null;
    await act(async () => { id = await result.current.handleSave(); order.push('saved'); });
    expect(id).toBe('e9');
    expect(order).toEqual(['reload', 'saved']);
    expect(createElection).toHaveBeenCalledWith({ name: 'Kerala Vidhan Sabha 2026', type: 'VS', year: new Date().getFullYear(), state_id: 32 });
    expect(result.current.dirty).toBe(false);
  });

  it('validates the year instead of sending NaN', async () => {
    expect(isValidElectionYear('2026')).toBe(true);
    expect(isValidElectionYear('')).toBe(false);
    expect(isValidElectionYear('20x6')).toBe(false);
    const { result } = renderHook(() => useElectionManager(), { wrapper });
    act(() => result.current.startEdit(bihar));
    act(() => result.current.setForm({ ...result.current.form, year: '20' }));
    let id: string | null = 'x';
    await act(async () => { id = await result.current.handleSave(); });
    expect(id).toBeNull();
    expect(updateElection).not.toHaveBeenCalled();
  });

  it('after a save the submitted form is the baseline and edits typed during the save stay dirty', async () => {
    let release: () => void = () => {};
    vi.mocked(updateElection).mockImplementationOnce(() => new Promise((r) => { release = () => r({} as Election); }));
    const { result } = renderHook(() => useElectionManager(), { wrapper });
    act(() => result.current.startEdit(bihar));
    act(() => result.current.setForm({ ...result.current.form, name: 'Renamed' }));
    let p: Promise<string | null> = Promise.resolve(null);
    act(() => { p = result.current.handleSave(); });
    act(() => result.current.setForm({ ...result.current.form, name: 'Renamed again' }));
    await act(async () => { release(); await p; });
    expect(result.current.form.name).toBe('Renamed again');
    expect(result.current.dirty).toBe(true);
    act(() => result.current.revert());
    expect(result.current.form.name).toBe('Renamed');
  });
});
