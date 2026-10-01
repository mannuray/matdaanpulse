// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Party } from '../types';
import { ApiError } from '../services/api-client';

const api = vi.hoisted(() => ({
  getPartiesPaginated: vi.fn(),
  getParty: vi.fn(),
  updateParty: vi.fn(async () => ({})),
  createParty: vi.fn(),
  getStates: vi.fn(async () => [{ id: 1, name: 'Bihar', code: 'BR' }]),
}));
vi.mock('../services/geo.service', () => api);
vi.mock('../services/election.service', () => ({ getElections: vi.fn(async () => []) }));
import Parties from './Parties';
import { renderEntityPage } from '../test-utils/entity-harness';

const party = (id: string, name: string, over: Partial<Party> = {}): Party & { candidate_count: number } => ({
  id, name, color: '#f59e0b', symbol_url: null, eci_symbol_url: null, abbreviation: id, leader_name: null, founded_year: 1980,
  headquarters: null, website: null, wikipedia_url: null, description: null, candidate_count: 12, ...over,
});
const ROWS = [party('BJP', 'Bharatiya Janata Party'), party('INC', 'Indian National Congress', { color: '#0ea5e9' })];

beforeEach(() => {
  api.getPartiesPaginated.mockImplementation(async (page: number) => ({
    success: true,
    data: page === 1 ? ROWS : [party('RJD', 'Rashtriya Janata Dal')],
    pagination: { page, limit: 25, total: 26, totalPages: 2 },
  }));
  api.getParty.mockImplementation(async (id: string) => ROWS.find((p) => p.id === id) ?? party(id, `Party ${id}`));
  api.createParty.mockImplementation(async (d: { id: string; name: string }) => party(d.id, d.name));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/parties') => renderEntityPage('/parties', <Parties />, at);
const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Parties' });

describe('Parties page', () => {
  it('lists parties with candidate counts and opens a row in the panel at /parties/:id', async () => {
    renderAt();
    expect(await within(table()).findByText('Bharatiya Janata Party')).toBeTruthy();
    expect(within(table()).getAllByText('12')).toHaveLength(2);
    fireEvent.click(within(table()).getByText('Indian National Congress'));
    expect(where()).toBe('/parties/INC');
    const panel = await screen.findByRole('dialog');
    await waitFor(() => expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Indian National Congress'));
    expect(within(panel).getByText('INC · 12 candidates')).toBeTruthy();
  });

  it('saves the edited form and refreshes the list', async () => {
    renderAt('/parties/BJP');
    const panel = await screen.findByRole('dialog');
    fireEvent.change(await within(panel).findByDisplayValue('Bharatiya Janata Party'), { target: { value: 'BJP renamed' } });
    expect(within(panel).getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateParty).toHaveBeenCalledWith('BJP', expect.objectContaining({ name: 'BJP renamed', founded_year: 1980 })));
    await waitFor(() => expect(api.getPartiesPaginated).toHaveBeenCalledTimes(2));
  });

  it('with unsaved edits: another row, Esc and close ask first; cancel keeps the record; an outside click does nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/parties/BJP');
    const panel = await screen.findByRole('dialog');
    fireEvent.change(await within(panel).findByDisplayValue('Bharatiya Janata Party'), { target: { value: 'Edited' } });
    fireEvent.click(within(table()).getByText('Indian National Congress'));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/parties/BJP');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(where()).toBe('/parties/BJP');
    fireEvent.pointerDown(table());
    expect(confirm).toHaveBeenCalledTimes(2);
    expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Edited');
    confirm.mockReturnValue(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Close panel' }));
    expect(where()).toBe('/parties');
  });

  it('switching rows quickly shows the last clicked record (panels are keyed by id)', async () => {
    let releaseBjp!: (p: Party) => void;
    api.getParty.mockImplementationOnce(() => new Promise<Party>((r) => { releaseBjp = r; }));
    renderAt('/parties/BJP');
    fireEvent.click(await within(table()).findByText('Indian National Congress'));
    const panel = await screen.findByRole('dialog');
    await within(panel).findByDisplayValue('Indian National Congress');
    releaseBjp(ROWS[0]);
    await new Promise((r) => setTimeout(r, 0));
    expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Indian National Congress');
  });

  it('a deep link to an unknown party shows "not found" in the panel', async () => {
    api.getParty.mockRejectedValueOnce(new ApiError('Party not found', 404));
    renderAt('/parties/NOPE');
    expect(await within(await screen.findByRole('dialog')).findByText('Party not found')).toBeTruthy();
  });

  it('New party opens /parties/new and, once created, shows the new record', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'New party' }));
    expect(where()).toBe('/parties/new');
    const panel = await screen.findByRole('dialog', { name: 'New party' });
    fireEvent.change(within(panel).getByLabelText('ID'), { target: { value: 'aap' } });
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Aam Aadmi Party' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create party' }));
    await waitFor(() => expect(api.createParty).toHaveBeenCalledWith({ id: 'AAP', name: 'Aam Aadmi Party', color: '#3b82f6', abbreviation: undefined }));
    await waitFor(() => expect(where()).toBe('/parties/AAP'));
  });

  it('pages through the list', async () => {
    renderAt();
    await within(table()).findByText('Bharatiya Janata Party');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await within(table()).findByText('Rashtriya Janata Dal')).toBeTruthy();
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  });

  it('old /parties/:id/edit links land on the panel, keeping the query', async () => {
    renderAt('/parties/BJP/edit?election=e1');
    expect(where()).toBe('/parties/BJP?election=e1');
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('a non-404 load failure says "Could not load party" and Try again reloads', async () => {
    api.getParty.mockRejectedValueOnce(new ApiError('boom', 500));
    renderAt('/parties/BJP');
    const panel = await screen.findByRole('dialog');
    expect(await within(panel).findByText('Could not load party')).toBeTruthy();
    expect(within(panel).queryByText('Party not found')).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Try again' }));
    expect(await within(panel).findByDisplayValue('Bharatiya Janata Party')).toBeTruthy();
  });

  it('a non-numeric founded year shows an error and disables Save; retyping the original year stays clean', async () => {
    renderAt('/parties/BJP');
    const panel = await screen.findByRole('dialog');
    const year = await within(panel).findByLabelText('Founded year');
    fireEvent.change(year, { target: { value: 'abc' } });
    expect(within(panel).getByText('Enter a 4-digit year')).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(year, { target: { value: '1980' } });
    expect(within(panel).getByText('No changes')).toBeTruthy();
  });

  it('shows server field errors under the field', async () => {
    api.updateParty.mockRejectedValueOnce(new ApiError('Validation failed', 400, 'VALIDATION', [{ field: 'name', message: 'Name already taken' }]));
    renderAt('/parties/BJP');
    const panel = await screen.findByRole('dialog');
    fireEvent.change(await within(panel).findByDisplayValue('Bharatiya Janata Party'), { target: { value: 'Dup' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByText('Name already taken')).toBeTruthy();
  });

  it('the State filter reaches the server and the Symbol filter narrows the rows', async () => {
    api.getPartiesPaginated.mockImplementation(async () => ({
      success: true,
      data: [party('BJP', 'Bharatiya Janata Party', { symbol_url: 'https://x/lotus.png' }), party('INC', 'Indian National Congress')],
      pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
    }));
    renderAt();
    await within(table()).findByText('Bharatiya Janata Party');
    await screen.findByRole('option', { name: 'Bihar' });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: '1' } });
    await waitFor(() => expect(api.getPartiesPaginated).toHaveBeenLastCalledWith(1, 25, undefined, undefined, 1));
    fireEvent.change(screen.getByLabelText('Symbol (this page)'), { target: { value: 'missing' } });
    await waitFor(() => expect(within(table()).queryByText('Bharatiya Janata Party')).toBeNull());
    expect(within(table()).getByText('Indian National Congress')).toBeTruthy();
  });

  it('Enter in the create form submits when required fields are filled', async () => {
    renderAt('/parties/new');
    const panel = await screen.findByRole('dialog', { name: 'New party' });
    fireEvent.change(within(panel).getByLabelText('ID'), { target: { value: 'x' } });
    fireEvent.submit(within(panel).getByLabelText('ID').closest('form')!);
    expect(api.createParty).not.toHaveBeenCalled();
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'X Party' } });
    fireEvent.submit(within(panel).getByLabelText('ID').closest('form')!);
    await waitFor(() => expect(api.createParty).toHaveBeenCalledTimes(1));
  });
});
