// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { PersonWithStats } from '../types';

const api = vi.hoisted(() => ({
  getPersons: vi.fn(),
  getPerson: vi.fn(),
  updatePerson: vi.fn(async () => ({})),
  mergePersons: vi.fn(async () => ({ merged: true, target_id: 'p1' })),
}));
vi.mock('../services/person.api', () => api);
const auth = vi.hoisted(() => ({ role: 'EDITOR' }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: auth.role, email: 'x' }, hasRole: (...r: string[]) => r.includes(auth.role) }),
}));
import { ApiError } from '../services/api-client';
import Persons from './Persons';
import { renderEntityPage } from '../test-utils/entity-harness';

const P = (id: string, name: string, gender: string | null, count = 2): PersonWithStats => ({
  id, name, photo_url: null, gender, education: 'BA', date_of_birth: null, candidate_count: count,
  elections: [], state_id: null, state_name: null, region_id: null, region_name: null,
});
const PAGE1 = [P('p1', 'Nitish Kumar', 'M'), P('p3', 'Rabri Devi', 'Female'), P('p4', 'Unknown Person', null)];
const page = (data: PersonWithStats[], p = 1) => ({ success: true, data, pagination: { page: p, limit: 50, total: 120, totalPages: 3 } });

beforeEach(() => {
  auth.role = 'EDITOR';
  api.getPersons.mockImplementation(async (p: number, limit: number) =>
    limit === 20 ? page([P('p1', 'Nitish Kumar', 'M'), P('p2', 'Nitish Kr', 'M', 1)]) : page(p === 1 ? PAGE1 : [P('p9', 'Page Two', 'M')], p));
  api.getPerson.mockImplementation(async (id: string) => ({
    ...(PAGE1.find((x) => x.id === id) ?? P(id, `Person ${id}`, null)),
    bio: null,
    metadata: { caste: 'Kurmi' },
    candidates: [{
      id: 'c1', person_id: id, election_id: 'e1', const_id: 's1', party_id: 'JDU', party: null, name: 'Nitish Kumar',
      is_incumbent: true, constituency_name: 'Harnaut', election_name: 'Bihar Vidhan Sabha', election_year: 2020,
    }],
  }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/persons') => renderEntityPage('/persons', <Persons />, at);
const table = () => screen.getByRole('table', { name: 'Persons' });

describe('Persons page', () => {
  it('shows stored gender values readably', async () => {
    renderAt();
    const row = (await within(table()).findByText('Nitish Kumar')).closest('tr')!;
    expect(within(row).getByText('Male')).toBeTruthy();
    expect(within(within(table()).getByText('Rabri Devi').closest('tr')!).getByText('Female')).toBeTruthy();
    expect(within(within(table()).getByText('Unknown Person').closest('tr')!).getByText('Not specified')).toBeTruthy();
  });

  it('?q= becomes the initial search (the Candidates "find person" link works)', async () => {
    renderAt('/persons?q=Nitish');
    expect((screen.getByLabelText('Search persons') as HTMLInputElement).value).toBe('Nitish');
    await waitFor(() => expect(api.getPersons).toHaveBeenCalledWith(1, 50, 'Nitish'));
  });

  it('opens a person with history and read-only details; saving keeps the normalised gender', async () => {
    renderAt();
    fireEvent.click(await within(table()).findByText('Nitish Kumar'));
    const panel = await screen.findByRole('dialog', { name: 'Nitish Kumar' });
    expect(await within(panel).findByText('Harnaut')).toBeTruthy();
    expect(within(panel).getByText('Kurmi')).toBeTruthy();
    expect((within(panel).getByLabelText('Gender') as HTMLSelectElement).value).toBe('Male');
    fireEvent.change(within(panel).getByLabelText('Education'), { target: { value: 'MA' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updatePerson).toHaveBeenCalledWith('p1', expect.objectContaining({ education: 'MA', gender: 'Male' })));
  });

  it('an EDITOR does not see Merge duplicates', async () => {
    renderAt('/persons/p1');
    const panel = await screen.findByRole('dialog', { name: 'Nitish Kumar' });
    await within(panel).findByText('Harnaut');
    expect(within(panel).queryByText('Merge duplicates')).toBeNull();
  });

  it('a SUPER_ADMIN merges a duplicate into the open person and the list refreshes', async () => {
    auth.role = 'SUPER_ADMIN';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('/persons/p1');
    const panel = await screen.findByRole('dialog', { name: 'Nitish Kumar' });
    fireEvent.change(await within(panel).findByLabelText('Search duplicates'), { target: { value: 'Nitish' } });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Merge Nitish Kr into this record' }));
    await waitFor(() => expect(api.mergePersons).toHaveBeenCalledWith('p2', 'p1'));
    await waitFor(() => expect(api.getPersons.mock.calls.filter(([, l]) => l === 50)).toHaveLength(2));
  });

  it('Merge is disabled while the form has unsaved edits (a merge reloads the record)', async () => {
    auth.role = 'SUPER_ADMIN';
    renderAt('/persons/p1');
    const panel = await screen.findByRole('dialog', { name: 'Nitish Kumar' });
    fireEvent.change(await within(panel).findByLabelText('Search duplicates'), { target: { value: 'Nitish' } });
    const merge = await within(panel).findByRole('button', { name: 'Merge Nitish Kr into this record' });
    fireEvent.change(within(panel).getByLabelText('Bio'), { target: { value: 'New bio' } });
    expect((merge as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).getByText('Save or cancel your changes first.')).toBeTruthy();
  });

  it('pages through persons', async () => {
    renderAt();
    await within(table()).findByText('Nitish Kumar');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await within(table()).findByText('Page Two')).toBeTruthy();
    expect(api.getPersons).toHaveBeenLastCalledWith(2, 50, undefined);
  });

  it('a failed load shows a retry, not "not found"; a 404 shows "Person not found"', async () => {
    api.getPerson.mockRejectedValueOnce(new Error('boom'));
    renderAt('/persons/p1');
    const panel = await screen.findByRole('dialog');
    fireEvent.click(await within(panel).findByRole('button', { name: 'Try again' }));
    expect(await within(panel).findByText('Harnaut')).toBeTruthy();
    expect(within(panel).queryByText('Person not found')).toBeNull();
  });

  it('a 404 shows "Person not found" with no retry', async () => {
    api.getPerson.mockRejectedValueOnce(new ApiError('Not found', 404));
    renderAt('/persons/gone');
    const panel = await screen.findByRole('dialog');
    expect(await within(panel).findByText('Person not found')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
