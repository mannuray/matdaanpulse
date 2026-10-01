// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Election, PersonCandidate, PersonWithStats } from '../types';

const api = vi.hoisted(() => ({
  getPersons: vi.fn(),
  getPerson: vi.fn(),
  updatePerson: vi.fn(async () => ({})),
  mergePersons: vi.fn(async () => ({ merged: true, target_id: 'p1' })),
}));
vi.mock('../services/person.api', () => api);
const ELECTIONS = vi.hoisted((): Election[] => [
  { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', state_id: 1, year: 2025, status: 'Live', tentative_next_date: null, manifest_url: null },
  { id: 'e2', name: 'Bihar Vidhan Sabha 2020', type: 'VS', state_id: 1, year: 2020, status: 'Finalized', tentative_next_date: null, manifest_url: null },
]);
vi.mock('../services/election.service', () => ({ getElections: vi.fn(async () => ELECTIONS) }));
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
const PAGE1 = [P('6a14c00a-1111-2222-3333-444455556666', 'Nitish Kumar', 'M'), P('p3', 'Rabri Devi', 'Female'), P('p4', 'Unknown Person', null)];
const NITISH = PAGE1[0].id;
const page = (data: PersonWithStats[], p = 1) => ({ success: true, data, pagination: { page: p, limit: 50, total: 120, totalPages: 3 } });

const contest = (over: Partial<PersonCandidate>): PersonCandidate => ({
  id: 'c', name: 'Nitish Kumar', party_id: 'JDU', party_name: 'Janata Dal (United)', party_color: '#16a34a',
  election_id: 'e', election_name: 'Bihar Vidhan Sabha 2020', election_year: 2020, election_type: 'VS', election_status: 'Finalized',
  const_id: 's', constituency_name: 'Harnaut', const_no: 179, votes: 0, status: null, margin: 0, is_incumbent: false, ...over,
});
// Newest first, as the API returns them.
const HISTORY: PersonCandidate[] = [
  contest({ id: 'c25', election_id: 'e1', election_name: 'Bihar Vidhan Sabha 2025', election_year: 2025, election_status: 'Live', status: 'LEADING', is_incumbent: true }),
  contest({ id: 'c20', election_id: 'e2', status: 'WON', is_incumbent: true }),
  contest({
    id: 'c04', election_id: 'e0', election_name: 'Lok Sabha General Election 2004', election_year: 2004, election_type: 'LS',
    constituency_name: 'Barh', const_no: 28, status: 'TRAILING',
  }),
];

beforeEach(() => {
  auth.role = 'EDITOR';
  api.getPersons.mockImplementation(async (p: number, limit: number) =>
    limit === 20 ? page([P(NITISH, 'Nitish Kumar', 'M'), P('p2', 'Nitish Kr', 'M', 1)]) : page(p === 1 ? PAGE1 : [P('p9', 'Page Two', 'M')], p));
  api.getPerson.mockImplementation(async (id: string) => ({
    ...(PAGE1.find((x) => x.id === id) ?? P(id, `Person ${id}`, null)),
    bio: null,
    metadata: { caste: 'Kurmi', wikipedia_url: 'https://en.wikipedia.org/wiki/Nitish_Kumar' },
    candidates: id === NITISH ? HISTORY : [],
    updated_at: '2026-10-02T09:02:00Z',
    last_edit: null,
  }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/persons') => renderEntityPage('/persons', <Persons />, at, { shell: true });
const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Persons' });
const heading = () => screen.findByRole('heading', { level: 1, name: 'Nitish Kumar' });
const back = () => screen.getByRole('button', { name: 'Persons' });
const history = () => screen.getByRole('heading', { name: 'Election history' }).closest('section')!;
const row = (name: RegExp) => within(history()).getByRole('link', { name });

describe('Persons list', () => {
  it('shows stored gender values readably', async () => {
    renderAt();
    const r = (await within(table()).findByText('Nitish Kumar')).closest('tr')!;
    expect(within(r).getByText('Male')).toBeTruthy();
    expect(within(within(table()).getByText('Rabri Devi').closest('tr')!).getByText('Female')).toBeTruthy();
    expect(within(within(table()).getByText('Unknown Person').closest('tr')!).getByText('Not specified')).toBeTruthy();
  });

  it('?q= becomes the initial search (the Candidates "find person" link works)', async () => {
    renderAt('/persons?q=Nitish');
    expect((screen.getByLabelText('Search persons') as HTMLInputElement).value).toBe('Nitish');
    await waitFor(() => expect(api.getPersons).toHaveBeenCalledWith(1, 50, 'Nitish'));
  });

  it('pages through persons', async () => {
    renderAt();
    await within(table()).findByText('Nitish Kumar');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await within(table()).findByText('Page Two')).toBeTruthy();
    expect(api.getPersons).toHaveBeenLastCalledWith(2, 50, undefined);
  });

  it('a row opens the record page in place of the list; back returns to the same page of the list', async () => {
    renderAt('/persons?election=e1');
    await within(table()).findByText('Nitish Kumar');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await within(table()).findByText('Page Two'));
    expect(where()).toBe('/persons/p9?election=e1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Person p9' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Persons' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(back());
    expect(where()).toBe('/persons?election=e1');
    expect(await within(table()).findByText('Page Two')).toBeTruthy();
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
  });
});

describe('Person record page', () => {
  it('header: name, "N contests · first YYYY" and the short id', async () => {
    renderAt(`/persons/${NITISH}`);
    expect(await heading()).toBeTruthy();
    expect(screen.getByText('3 contests · first 2004')).toBeTruthy();
    expect(screen.getByText('id 6a14c00a')).toBeTruthy();
  });

  it('Profile, Links and Biography cards; census tags are read only; Wikipedia has an Open link', async () => {
    renderAt(`/persons/${NITISH}`);
    await heading();
    for (const t of ['Profile', 'Links', 'Biography', 'Record']) expect(screen.getByRole('heading', { name: t })).toBeTruthy();
    expect(screen.getByText('Census tags: Kurmi')).toBeTruthy();
    const open = screen.getByRole('link', { name: /Open/ }) as HTMLAnchorElement;
    expect(open.href).toBe('https://en.wikipedia.org/wiki/Nitish_Kumar');
    expect(open.target).toBe('_blank');
    expect(screen.getByText('No edits recorded')).toBeTruthy();
  });

  it('no census tags line when none are recorded', async () => {
    api.getPerson.mockImplementationOnce(async (id: string) => ({ ...P(id, 'Blank Person', null), bio: null, metadata: {}, candidates: [] }));
    renderAt('/persons/p7');
    await screen.findByRole('heading', { level: 1, name: 'Blank Person' });
    expect(screen.queryByText(/Census tags/)).toBeNull();
    expect(screen.getByText('0 contests')).toBeTruthy();
    expect(screen.getByText('No contests recorded.')).toBeTruthy();
  });

  it('history badges: WON is "Won"; non-WON on a Finalized election is "Lost"; a Live election shows its status', async () => {
    renderAt(`/persons/${NITISH}`);
    await heading();
    expect(within(history()).getByText('3 recorded')).toBeTruthy();
    const links = within(history()).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining('Bihar VS 2025'), expect.stringContaining('Bihar VS 2020'), expect.stringContaining('Lok Sabha 2004'),
    ]);

    const won = row(/Bihar VS 2020/);
    expect(within(won).getByText('Won')).toBeTruthy();
    expect(within(won).getByText('Incumbent')).toBeTruthy();
    expect(within(won).getByText('179 Harnaut')).toBeTruthy();
    expect(within(won).getByText('JDU')).toBeTruthy();

    const lost = row(/Lok Sabha 2004/);
    expect(within(lost).getByText('Lost')).toBeTruthy();
    expect(within(lost).queryByText('Trailing')).toBeNull();
    expect(within(lost).queryByText('Incumbent')).toBeNull();

    const live = row(/Bihar VS 2025/);
    expect(within(live).getByText('Leading')).toBeTruthy();
    expect(within(live).queryByText('Lost')).toBeNull();
    expect(within(live).queryByText('Won')).toBeNull();
  });

  it('a Live election with no result yet shows no outcome badge', async () => {
    api.getPerson.mockImplementationOnce(async (id: string) => ({
      ...P(id, 'Nitish Kumar', 'M'), bio: null, metadata: {},
      candidates: [contest({ id: 'c25', election_id: 'e1', election_name: 'Bihar Vidhan Sabha 2025', election_year: 2025, election_status: 'Live', status: null })],
    }));
    renderAt(`/persons/${NITISH}`);
    await heading();
    const live = row(/Bihar VS 2025/);
    for (const t of ['Won', 'Lost', 'Leading']) expect(within(live).queryByText(t)).toBeNull();
  });

  it('a history row opens the candidate in its election', async () => {
    renderAt(`/persons/${NITISH}?election=e1`);
    await heading();
    fireEvent.click(row(/Bihar VS 2020/));
    expect(where()).toBe('/candidates/c20?election=e2');
  });

  it('saving keeps the normalised gender and the other metadata; bio and Wikipedia go into metadata', async () => {
    renderAt(`/persons/${NITISH}`);
    await heading();
    expect((screen.getByLabelText('Gender') as HTMLSelectElement).value).toBe('Male');
    fireEvent.change(screen.getByLabelText('Education'), { target: { value: 'MA' } });
    fireEvent.change(screen.getByLabelText('Biographical summary'), { target: { value: 'New bio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updatePerson).toHaveBeenCalledWith(NITISH, expect.objectContaining({
      education: 'MA', gender: 'Male', bio: 'New bio',
      metadata: { caste: 'Kurmi', wikipedia_url: 'https://en.wikipedia.org/wiki/Nitish_Kumar', bio: 'New bio' },
    })));
  });

  it('emptied fields are saved as null, never ""', async () => {
    renderAt(`/persons/${NITISH}`);
    await heading();
    fireEvent.change(screen.getByLabelText('Education'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Wikipedia URL'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updatePerson).toHaveBeenCalled());
    const body = (api.updatePerson.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(body).toMatchObject({ education: null, wikipedia_url: null, photo_url: null, date_of_birth: null, bio: null });
    expect(body.metadata).toEqual({ caste: 'Kurmi', wikipedia_url: null, bio: null });
    expect(Object.values(body)).not.toContain('');
  });

  it('saving an unrelated field keeps a null gender/education as null', async () => {
    api.getPerson.mockImplementationOnce(async (id: string) => ({ ...P(id, 'Blank Person', null), education: null, bio: null, metadata: {}, candidates: [] }));
    renderAt('/persons/p7');
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Blank P.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updatePerson).toHaveBeenCalledWith('p7', expect.objectContaining({ name: 'Blank P.', gender: null, education: null })));
  });

  it('with unsaved edits, back, a sidebar link, the election picker and a history row ask first; Cancel stays', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const at = `/persons/${NITISH}?election=e1`;
    renderAt(at);
    await heading();
    fireEvent.change(screen.getByLabelText('Education'), { target: { value: 'MA' } });

    fireEvent.click(back());
    expect(confirm).toHaveBeenLastCalledWith('Discard unsaved changes?');
    expect(where()).toBe(at);

    fireEvent.click(screen.getByRole('link', { name: /Candidates/ }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(where()).toBe(at);

    fireEvent.click(screen.getByRole('button', { name: 'Election' }));
    fireEvent.click(screen.getByRole('option', { name: '2020' }));
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(where()).toBe(at);

    fireEvent.click(row(/Bihar VS 2020/));
    expect(confirm).toHaveBeenCalledTimes(4);
    expect(where()).toBe(at);

    expect((screen.getByLabelText('Education') as HTMLInputElement).value).toBe('MA');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    confirm.mockReturnValue(true);
    fireEvent.click(back());
    expect(where()).toBe('/persons?election=e1');
  });

  it('Cancel reverts the edits', async () => {
    renderAt(`/persons/${NITISH}`);
    await heading();
    fireEvent.change(screen.getByLabelText('Education'), { target: { value: 'MA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((screen.getByLabelText('Education') as HTMLInputElement).value).toBe('BA');
    expect(screen.getByText('No changes')).toBeTruthy();
  });

  it('a failed load shows "Could not load person" and Try again reloads', async () => {
    api.getPerson.mockRejectedValueOnce(new Error('boom'));
    renderAt(`/persons/${NITISH}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await heading()).toBeTruthy();
    expect(screen.queryByText('Person not found')).toBeNull();
  });

  it('a 404 shows "Person not found" with no retry and no toast', async () => {
    api.getPerson.mockRejectedValueOnce(new ApiError('Not found', 404));
    renderAt('/persons/gone');
    expect(await screen.findByText('Person not found')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getAllByText('Person not found')).toHaveLength(1);
    expect(screen.queryByText(/Failed to load person/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});

describe('Merge duplicate', () => {
  it('is hidden for an EDITOR', async () => {
    renderAt(`/persons/${NITISH}`);
    await heading();
    expect(screen.queryByRole('heading', { name: 'Merge duplicate' })).toBeNull();
    expect(screen.queryByLabelText('Search duplicates')).toBeNull();
  });

  it('a SUPER_ADMIN merges a duplicate into the open person after confirming, and the list refreshes', async () => {
    auth.role = 'SUPER_ADMIN';
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt(`/persons/${NITISH}`);
    await heading();
    expect(screen.getByText('Super admin')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search duplicates'), { target: { value: 'Nitish' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Merge Nitish Kr into this record' }));
    await waitFor(() => expect(api.mergePersons).toHaveBeenCalledWith('p2', NITISH));
    expect(confirm.mock.calls[0][0]).toContain('into "Nitish Kumar"');
    await waitFor(() => expect(api.getPersons.mock.calls.filter(([, l]) => l === 50)).toHaveLength(2));
  });

  it('declining the confirmation does not merge', async () => {
    auth.role = 'SUPER_ADMIN';
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt(`/persons/${NITISH}`);
    await heading();
    fireEvent.change(screen.getByLabelText('Search duplicates'), { target: { value: 'Nitish' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Merge Nitish Kr into this record' }));
    expect(api.mergePersons).not.toHaveBeenCalled();
  });

  it('is disabled while the form has unsaved edits (a merge reloads the record)', async () => {
    auth.role = 'SUPER_ADMIN';
    renderAt(`/persons/${NITISH}`);
    await heading();
    fireEvent.change(screen.getByLabelText('Search duplicates'), { target: { value: 'Nitish' } });
    const merge = await screen.findByRole('button', { name: 'Merge Nitish Kr into this record' });
    fireEvent.change(screen.getByLabelText('Biographical summary'), { target: { value: 'New bio' } });
    expect((merge as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Save or cancel your changes first.')).toBeTruthy();
  });

  it('a failed reload after a merge shows an inline retry', async () => {
    auth.role = 'SUPER_ADMIN';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt(`/persons/${NITISH}`);
    await heading();
    fireEvent.change(screen.getByLabelText('Search duplicates'), { target: { value: 'Nitish' } });
    const btn = await screen.findByRole('button', { name: 'Merge Nitish Kr into this record' });
    api.getPerson.mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(btn);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText('Could not reload person')).toBeNull());
    expect(await heading()).toBeTruthy();
  });
});
