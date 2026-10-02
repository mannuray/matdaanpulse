// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/candidate.service', () => ({
  getCandidate: vi.fn(async () => ({
    id: 'c1', person_id: null, person: null, election_id: 'e1', const_id: 's1', party_id: 'BJP', party: null,
    name: 'Ravi Prasad', is_incumbent: false, metadata: { age: 58, criminal_cases: 0, affidavit_url: 'https://x/a.pdf' },
  })),
  updateCandidate: vi.fn(async () => ({})),
  linkCandidatePerson: vi.fn(async () => ({})),
  unlinkCandidatePerson: vi.fn(async () => ({})),
}));
vi.mock('../services/person.api', () => ({
  getPersons: vi.fn(async () => ({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
  createPerson: vi.fn(async () => ({ id: 'p9' })),
}));
vi.mock('../services/geo.service', () => ({ getParties: vi.fn(async () => []) }));
import { useCandidateEdit } from './useCandidateEdit';
import { updateCandidate } from '../services/candidate.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

describe('useCandidateEdit save payload', () => {
  it('has no photo_url, keeps 0 cases, sends emptied optional fields as null, and keeps other metadata', async () => {
    const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
    await waitFor(() => expect(result.current.candidate).not.toBeNull());
    expect('photo_url' in result.current.form).toBe(false);
    expect(result.current.form.criminal_cases).toBe('0');
    act(() => result.current.setForm({ ...result.current.form, age: '' }));
    await act(() => result.current.handleSave());
    const [, payload] = vi.mocked(updateCandidate).mock.calls[0];
    expect(payload).not.toHaveProperty('photo_url');
    expect(payload.metadata).toEqual({ affidavit_url: 'https://x/a.pdf', age: null, gender: null, education: null, criminal_cases: 0, assets: null });
    expect(payload.is_incumbent).toBe(false);
  });

  it('the Incumbent toggle is part of the form: it makes the form dirty and is saved', async () => {
    const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
    await waitFor(() => expect(result.current.candidate).not.toBeNull());
    expect(result.current.form.is_incumbent).toBe(false);
    act(() => result.current.setForm({ ...result.current.form, is_incumbent: true }));
    expect(result.current.dirty).toBe(true);
    await act(() => result.current.handleSave());
    expect(vi.mocked(updateCandidate).mock.calls[0][1]).toEqual(expect.objectContaining({ is_incumbent: true }));
  });

  it('is clean after load, pre-fills the person search with the name while unlinked, and reset drops edits', async () => {
    const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.candidate).not.toBeNull());
    expect(result.current.dirty).toBe(false);
    expect(result.current.personSearch).toBe('Ravi Prasad');
    act(() => result.current.setForm({ ...result.current.form, education: 'BA' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
  });
});
