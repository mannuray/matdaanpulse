// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/candidate.service', () => ({
  getCandidate: vi.fn(async () => ({
    id: 'c1', person_id: 'p1', person: { id: 'p1', name: 'Ravi Shankar Prasad', photo_url: null, gender: null, education: null, date_of_birth: null },
    election_id: 'e1', const_id: 's1', party_id: 'BJP', party: null,
    name: 'Ravi Prasad', is_incumbent: false, age: 58, assets: 0, liabilities: 1250000, criminal_cases: 0,
    person_contests: { contests: 2, first_year: 2015 },
  })),
  updateCandidate: vi.fn(async () => ({})),
  changeCandidatePerson: vi.fn(async () => ({})),
  splitCandidate: vi.fn(async () => ({ person_id: 'p-new', old_person_deleted: false })),
}));
vi.mock('../services/person.api', () => ({
  getPersons: vi.fn(async () => ({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
}));
vi.mock('../services/geo.service', () => ({ getParties: vi.fn(async () => []) }));
import { useCandidateEdit, candidateAffidavit, candidateNumbersValid } from './useCandidateEdit';
import { changeCandidatePerson, getCandidate, splitCandidate, updateCandidate } from '../services/candidate.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

describe('candidate affidavit', () => {
  it('blank is null, 0 stays 0, and rupee text with ₹ and commas becomes a number', () => {
    expect(candidateAffidavit({ age: '', assets: '0', liabilities: '₹12,50,000', criminal_cases: ' 0 ' }))
      .toEqual({ age: null, assets: 0, liabilities: 1250000, criminal_cases: 0 });
    expect(candidateAffidavit({ age: '  ', assets: '', liabilities: '', criminal_cases: '' }))
      .toEqual({ age: null, assets: null, liabilities: null, criminal_cases: null });
  });

  it('every affidavit field must be blank or a whole number (decimals and text are refused)', () => {
    const ok = { age: '45', assets: '24500000', liabilities: '', criminal_cases: '0' };
    expect(candidateNumbersValid(ok)).toBe(true);
    expect(candidateNumbersValid({ ...ok, assets: '2.5 crore' })).toBe(false);
    expect(candidateNumbersValid({ ...ok, liabilities: '100.50' })).toBe(false);
    expect(candidateNumbersValid({ ...ok, age: 'forty' })).toBe(false);
  });
});

describe('useCandidateEdit save payload', () => {
  it('sends exactly the whitelisted keys, top-level affidavit numbers, no metadata / gender / education', async () => {
    const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
    await waitFor(() => expect(result.current.candidate).not.toBeNull());
    expect(result.current.form).toMatchObject({ age: '58', assets: '0', liabilities: '1250000', criminal_cases: '0' });
    act(() => result.current.setForm({ ...result.current.form, age: '' }));
    await act(() => result.current.handleSave());
    const [, payload] = vi.mocked(updateCandidate).mock.calls[0];
    expect(payload).toEqual({
      name: 'Ravi Prasad', party_id: 'BJP', is_incumbent: false,
      age: null, assets: 0, liabilities: 1250000, criminal_cases: 0,
    });
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

  it('is clean after load (null affidavit fields load as blank), dirty after an edit, and reset drops edits', async () => {
    vi.mocked(getCandidate).mockResolvedValueOnce({
      ...(await vi.mocked(getCandidate).getMockImplementation()!('c1')), age: null, assets: null, liabilities: null, criminal_cases: null,
    });
    const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.candidate).not.toBeNull());
    expect(result.current.form).toMatchObject({ age: '', assets: '', liabilities: '', criminal_cases: '' });
    expect(result.current.dirty).toBe(false);
    expect(result.current.personSearch).toBe('');
    act(() => result.current.setForm({ ...result.current.form, liabilities: '10' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
  });
});

describe('useCandidateEdit person actions', () => {
  it('changePerson moves the candidacy and reloads the record', async () => {
    const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
    await waitFor(() => expect(result.current.candidate).not.toBeNull());
    let ok = false;
    await act(async () => { ok = await result.current.changePerson('p5'); });
    expect(ok).toBe(true);
    expect(changeCandidatePerson).toHaveBeenCalledWith('c1', 'p5');
    await waitFor(() => expect(getCandidate).toHaveBeenCalledTimes(2));
  });

  it('split returns the new person id and reloads the record', async () => {
    const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
    await waitFor(() => expect(result.current.candidate).not.toBeNull());
    let personId: string | null = null;
    await act(async () => { personId = await result.current.split(); });
    expect(personId).toBe('p-new');
    expect(splitCandidate).toHaveBeenCalledWith('c1');
    await waitFor(() => expect(getCandidate).toHaveBeenCalledTimes(2));
  });
});
