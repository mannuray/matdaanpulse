// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Election, Party, PartyUsage } from '../types';
import { ApiError } from '../services/api-client';

const api = vi.hoisted(() => ({
  getPartiesPaginated: vi.fn(),
  getParty: vi.fn(),
  getPartyUsage: vi.fn(),
  updateParty: vi.fn(async () => ({})),
  createParty: vi.fn(),
  getStates: vi.fn(async () => [{ id: 1, name: 'Bihar', code: 'BR' }]),
}));
vi.mock('../services/geo.service', () => api);
const ELECTIONS = vi.hoisted((): Election[] => [
  { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', state_id: 1, year: 2025, status: 'Live', tentative_next_date: null, manifest_url: null },
  { id: 'e2', name: 'Kerala Vidhan Sabha 2021', type: 'VS', state_id: 2, year: 2021, status: 'Finalized', tentative_next_date: null, manifest_url: null },
]);
vi.mock('../services/election.service', () => ({ getElections: vi.fn(async () => ELECTIONS) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: 'EDITOR' }, hasRole: (r: string) => r === 'EDITOR' }) }));
import Parties from './Parties';
import { renderEntityPage } from '../test-utils/entity-harness';

const party = (id: string, name: string, over: Partial<Party> = {}): Party & { candidate_count: number } => ({
  id, name, color: '#f59e0b', symbol_url: null, eci_symbol_url: null, abbreviation: id, leader_name: null, founded_year: 1980,
  headquarters: null, website: null, wikipedia_url: null, description: null, eci_recognition: null, candidate_count: 12, ...over,
});
const ROWS = [party('BJP', 'Bharatiya Janata Party', { eci_recognition: 'National' }), party('INC', 'Indian National Congress', { color: '#0ea5e9' })];
const USAGE: PartyUsage = {
  totals: { candidates: 1204, elections: 2, wins: 300 },
  elections: [
    { election_id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, candidates: 101, wins: 89 },
    { election_id: 'e2', name: 'Kerala Vidhan Sabha 2021', type: 'VS', year: 2021, candidates: 1103, wins: 211 },
    { election_id: 'e0', name: 'Lok Sabha General Election 2024', type: 'LS', year: 2024, candidates: 0, wins: 0 },
  ],
};

beforeEach(() => {
  api.getPartiesPaginated.mockImplementation(async (page: number) => ({
    success: true,
    data: page === 1 ? ROWS : [party('RJD', 'Rashtriya Janata Dal')],
    pagination: { page, limit: 25, total: 26, totalPages: 2 },
  }));
  api.getParty.mockImplementation(async (id: string) => ROWS.find((p) => p.id === id) ?? party(id, `Party ${id}`));
  api.getPartyUsage.mockImplementation(async () => USAGE);
  api.createParty.mockImplementation(async (d: { id: string; name: string }) => party(d.id, d.name));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/parties') => renderEntityPage('/parties', <Parties />, at, { shell: true });
const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Parties' });
const nameInput = () => screen.findByLabelText('Name') as Promise<HTMLInputElement>;
const back = () => screen.getByRole('button', { name: 'Parties' });

describe('Parties list', () => {
  it('lists parties with candidate counts and ECI recognition; a row opens its record page at /parties/:id', async () => {
    renderAt();
    expect(await within(table()).findByText('Bharatiya Janata Party')).toBeTruthy();
    expect(within(table()).getAllByText('12')).toHaveLength(2);
    expect(within(table()).getByText('National')).toBeTruthy();
    fireEvent.click(within(table()).getByText('Indian National Congress'));
    expect(where()).toBe('/parties/INC');
    expect(await screen.findByRole('heading', { level: 1, name: 'Indian National Congress' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Parties' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pages through the list', async () => {
    renderAt();
    await within(table()).findByText('Bharatiya Janata Party');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await within(table()).findByText('Rashtriya Janata Dal')).toBeTruthy();
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  });

  it('the State and ECI recognition filters reach the server and the Symbol filter narrows the rows', async () => {
    api.getPartiesPaginated.mockImplementation(async () => ({
      success: true,
      data: [party('BJP', 'Bharatiya Janata Party', { symbol_url: 'https://x/lotus.png' }), party('INC', 'Indian National Congress')],
      pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
    }));
    renderAt();
    await within(table()).findByText('Bharatiya Janata Party');
    await screen.findByRole('option', { name: 'Bihar' });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: '1' } });
    await waitFor(() => expect(api.getPartiesPaginated).toHaveBeenLastCalledWith(1, 25, undefined, undefined, 1, undefined));
    fireEvent.change(screen.getByLabelText('ECI recognition'), { target: { value: 'none' } });
    await waitFor(() => expect(api.getPartiesPaginated).toHaveBeenLastCalledWith(1, 25, undefined, undefined, 1, 'none'));
    fireEvent.change(screen.getByLabelText('ECI recognition'), { target: { value: 'State' } });
    await waitFor(() => expect(api.getPartiesPaginated).toHaveBeenLastCalledWith(1, 25, undefined, undefined, 1, 'State'));
    fireEvent.change(screen.getByLabelText('Symbol (this page)'), { target: { value: 'missing' } });
    await waitFor(() => expect(within(table()).queryByText('Bharatiya Janata Party')).toBeNull());
    expect(within(table()).getByText('Indian National Congress')).toBeTruthy();
  });

  it('a stale ECI recognition filter in localStorage falls back to All', async () => {
    localStorage.setItem('parties_filters', JSON.stringify({ eci: 'Bogus' }));
    renderAt();
    await within(table()).findByText('Bharatiya Janata Party');
    const filter = screen.getByLabelText('ECI recognition') as HTMLSelectElement;
    expect(filter.value).toBe('all');
    expect(filter.selectedOptions[0].textContent).toBe('All recognition');
    expect(api.getPartiesPaginated).toHaveBeenLastCalledWith(1, 25, undefined, undefined, undefined, undefined);
  });

  it('back from a record lands on the same page, filter and query string (Review focus 1)', async () => {
    api.getPartiesPaginated.mockImplementation(async (page: number) => ({
      success: true,
      data: [party(`P${page}`, `Party on page ${page}`)],
      pagination: { page, limit: 25, total: 75, totalPages: 3 },
    }));
    renderAt('/parties?election=e1');
    await within(table()).findByText('Party on page 1');
    fireEvent.change(screen.getByLabelText('ECI recognition'), { target: { value: 'National' } });
    fireEvent.change(screen.getByLabelText('Search parties'), { target: { value: 'party' } });
    await waitFor(() => expect(api.getPartiesPaginated).toHaveBeenLastCalledWith(1, 25, 'party', undefined, undefined, 'National'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await within(table()).findByText('Party on page 2');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await within(table()).findByText('Party on page 3'));
    expect(where()).toBe('/parties/P3?election=e1');
    await screen.findByRole('heading', { level: 1, name: 'Party P3' });
    const calls = api.getPartiesPaginated.mock.calls.length;

    fireEvent.click(back());
    expect(where()).toBe('/parties?election=e1');
    expect(within(table()).getByText('Party on page 3')).toBeTruthy();
    expect(screen.getByText('Page 3 of 3')).toBeTruthy();
    expect((screen.getByLabelText('ECI recognition') as HTMLSelectElement).value).toBe('National');
    expect((screen.getByLabelText('Search parties') as HTMLInputElement).value).toBe('party');
    // The list stayed mounted: nothing reloaded, so it could not have snapped back to page 1.
    expect(api.getPartiesPaginated.mock.calls.length).toBe(calls);
    expect(api.getPartiesPaginated).toHaveBeenLastCalledWith(3, 25, 'party', undefined, undefined, 'National');
  });
});

describe('Party record page', () => {
  it('header: swatch, name, abbreviation and ECI tags, and "N candidates · M elections"', async () => {
    renderAt('/parties/BJP');
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Bharatiya Janata Party' });
    const header = h1.closest('header')!;
    expect(within(header).getByText('BJP')).toBeTruthy();
    expect(within(header).getByText('National')).toBeTruthy();
    expect(await within(header).findByText('1,204 candidates · 2 elections')).toBeTruthy();
    expect(within(header).getByText('No changes')).toBeTruthy();
  });

  it('the Usage card renders totals and one row per election, linking to that election\'s candidates', async () => {
    renderAt('/parties/BJP?election=e1');
    const usage = (await screen.findByRole('heading', { name: 'Usage' })).closest('section')!;
    expect(await within(usage).findByText('1,204 candidates · 2 elections · 300 won')).toBeTruthy();
    expect(within(usage).getByText('Bihar VS 2025')).toBeTruthy();
    expect(within(usage).getByText('Lok Sabha 2024')).toBeTruthy();
    expect(within(usage).getByText('1,103 candidates · 211 won')).toBeTruthy();
    const row = within(usage).getByRole('link', { name: /Kerala VS 2021/ });
    expect(row.getAttribute('href')).toBe('/candidates?election=e2');
    fireEvent.click(row);
    expect(where()).toBe('/candidates?election=e2');
  });

  it('"View candidates" goes to the Candidates page', async () => {
    renderAt('/parties/BJP?election=e1');
    const link = await screen.findByRole('link', { name: /View candidates/ });
    fireEvent.click(link);
    expect(where()).toBe('/candidates');
  });

  it('a usage failure only blanks the Usage card; the form still loads', async () => {
    api.getPartyUsage.mockRejectedValueOnce(new ApiError('boom', 500));
    renderAt('/parties/BJP');
    expect((await nameInput()).value).toBe('Bharatiya Janata Party');
    const usage = screen.getByRole('heading', { name: 'Usage' }).closest('section')!;
    expect(await within(usage).findByText('Could not load usage')).toBeTruthy();
  });

  it('a party used nowhere says so', async () => {
    api.getPartyUsage.mockResolvedValueOnce({ totals: { candidates: 0, elections: 0, wins: 0 }, elections: [] });
    renderAt('/parties/INC');
    const usage = (await screen.findByRole('heading', { name: 'Usage' })).closest('section')!;
    expect(await within(usage).findByText('Not used in any election yet')).toBeTruthy();
  });

  it('the Record card shows the id, last updated and last edited by', async () => {
    api.getParty.mockResolvedValueOnce({ ...ROWS[0], updated_at: '2026-10-01T09:02:00Z', last_edit: { at: '2026-10-01T09:02:00Z', by: 'Mannu K' } });
    renderAt('/parties/BJP');
    const record = (await screen.findByRole('heading', { name: 'Record' })).closest('section')!;
    expect(await within(record).findByText(/^Mannu K · .*14:32/)).toBeTruthy();
    expect(within(record).getByText('BJP')).toBeTruthy();
  });

  it('saves the edited form, including ECI recognition, and refreshes the list', async () => {
    renderAt('/parties/INC');
    fireEvent.change(await nameInput(), { target: { value: 'INC renamed' } });
    fireEvent.change(screen.getByLabelText('ECI recognition'), { target: { value: 'State' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateParty).toHaveBeenCalledWith('INC', expect.objectContaining({ name: 'INC renamed', founded_year: 1980, eci_recognition: 'State' })));
    await waitFor(() => expect(api.getPartiesPaginated).toHaveBeenCalledTimes(2));
  });

  it('"Not set" saves eci_recognition as null', async () => {
    renderAt('/parties/BJP');
    await nameInput();
    const select = screen.getByLabelText('ECI recognition') as HTMLSelectElement;
    expect(select.value).toBe('National');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Not set', 'National', 'State', 'Unrecognised']);
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateParty).toHaveBeenCalledWith('BJP', expect.objectContaining({ eci_recognition: null })));
  });

  it('emptied text fields are saved as null, not \'\'', async () => {
    api.getParty.mockResolvedValueOnce({ ...ROWS[0], leader_name: 'J P Nadda', headquarters: 'Delhi', website: 'https://bjp.org', description: 'About' });
    renderAt('/parties/BJP');
    fireEvent.change(await screen.findByLabelText('Leader'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Headquarters'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateParty).toHaveBeenCalled());
    const body = (api.updateParty.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(body).toMatchObject({ leader_name: null, headquarters: null, website: null, description: null, wikipedia_url: null, symbol_url: null, eci_symbol_url: null, eci_recognition: 'National' });
    expect(Object.values(body)).not.toContain('');
  });

  it('Cancel reverts the edits', async () => {
    renderAt('/parties/BJP');
    fireEvent.change(await nameInput(), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((await nameInput()).value).toBe('Bharatiya Janata Party');
    expect(screen.getByText('No changes')).toBeTruthy();
  });

  it('with unsaved edits, back, a sidebar link and the election picker ask first; Cancel stays (Review focus 2)', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/parties/BJP?election=e1');
    fireEvent.change(await nameInput(), { target: { value: 'Edited' } });

    fireEvent.click(back());
    expect(confirm).toHaveBeenLastCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/parties/BJP?election=e1');

    fireEvent.click(screen.getByRole('link', { name: /Parties/ }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(where()).toBe('/parties/BJP?election=e1');
    fireEvent.click(screen.getByRole('link', { name: /Candidates/ }));
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(where()).toBe('/parties/BJP?election=e1');

    fireEvent.click(screen.getByRole('button', { name: 'Election' }));
    fireEvent.click(screen.getByRole('option', { name: '2021' }));
    expect(confirm).toHaveBeenCalledTimes(4);
    expect(where()).toBe('/parties/BJP?election=e1');

    expect((await nameInput()).value).toBe('Edited');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    confirm.mockReturnValue(true);
    fireEvent.click(back());
    expect(where()).toBe('/parties?election=e1');
  });

  it('with unsaved edits, a Usage row asks first and Cancel stays', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/parties/BJP?election=e1');
    fireEvent.change(await nameInput(), { target: { value: 'Edited' } });
    fireEvent.click(await screen.findByRole('link', { name: /Kerala VS 2021/ }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/parties/BJP?election=e1');
    fireEvent.click(screen.getByRole('link', { name: /View candidates/ }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(where()).toBe('/parties/BJP?election=e1');
  });

  it('a deep link to an unknown party says "Party not found"', async () => {
    api.getParty.mockRejectedValueOnce(new ApiError('Party not found', 404));
    renderAt('/parties/NOPE');
    expect(await screen.findByText('Party not found')).toBeTruthy();
    // The page says it; no error toast on top.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getAllByText('Party not found')).toHaveLength(1);
    expect(screen.queryByText(/Failed to load party/)).toBeNull();
    fireEvent.click(back());
    expect(where()).toBe('/parties');
  });

  it('a non-404 load failure says "Could not load party" and Try again reloads', async () => {
    api.getParty.mockRejectedValueOnce(new ApiError('boom', 500));
    renderAt('/parties/BJP');
    expect(await screen.findByText('Could not load party')).toBeTruthy();
    expect(screen.queryByText('Party not found')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect((await screen.findByDisplayValue('Bharatiya Janata Party'))).toBeTruthy();
  });

  it('a non-numeric founded year shows an error and disables Save; retyping the original year stays clean', async () => {
    renderAt('/parties/BJP');
    const year = await screen.findByLabelText('Founded year');
    fireEvent.change(year, { target: { value: 'abc' } });
    expect(screen.getByText('Enter a 4-digit year')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(year, { target: { value: '1980' } });
    expect(screen.getByText('No changes')).toBeTruthy();
  });

  it('shows server field errors under the field', async () => {
    api.updateParty.mockRejectedValueOnce(new ApiError('Validation failed', 400, 'VALIDATION', [{ field: 'name', message: 'Name already taken' }]));
    renderAt('/parties/BJP');
    fireEvent.change(await nameInput(), { target: { value: 'Dup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Name already taken')).toBeTruthy();
  });

  it('old /parties/:id/edit links land on the record page, keeping the query', async () => {
    renderAt('/parties/BJP/edit?election=e1');
    expect(where()).toBe('/parties/BJP?election=e1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Bharatiya Janata Party' })).toBeTruthy();
  });
});

describe('New party', () => {
  it('opens a dialog over the list at /parties/new and, once created, opens the new record page', async () => {
    api.getParty.mockImplementation(async (id: string) => party(id, 'Aam Aadmi Party'));
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'New party' }));
    expect(where()).toBe('/parties/new');
    const dialog = await screen.findByRole('dialog', { name: 'New party' });
    // The list stays behind the dialog (Radix hides it from the accessibility tree while open).
    expect(within(screen.getByRole('table', { name: 'Parties', hidden: true })).getByText('Bharatiya Janata Party')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('ID'), { target: { value: 'aap' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Aam Aadmi Party' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create party' }));
    await waitFor(() => expect(api.createParty).toHaveBeenCalledWith({ id: 'AAP', name: 'Aam Aadmi Party', color: '#3b82f6', abbreviation: undefined }));
    await waitFor(() => expect(where()).toBe('/parties/AAP'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Aam Aadmi Party' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Enter in the create form submits when required fields are filled', async () => {
    renderAt('/parties/new');
    const dialog = await screen.findByRole('dialog', { name: 'New party' });
    fireEvent.change(within(dialog).getByLabelText('ID'), { target: { value: 'x' } });
    fireEvent.submit(within(dialog).getByLabelText('ID').closest('form')!);
    expect(api.createParty).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'X Party' } });
    fireEvent.submit(within(dialog).getByLabelText('ID').closest('form')!);
    await waitFor(() => expect(api.createParty).toHaveBeenCalledTimes(1));
  });

  it('with typed fields, Esc asks first and Cancel keeps the dialog', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/parties/new');
    const dialog = await screen.findByRole('dialog', { name: 'New party' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'X Party' } });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/parties/new');
    confirm.mockReturnValue(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(where()).toBe('/parties');
  });
});
