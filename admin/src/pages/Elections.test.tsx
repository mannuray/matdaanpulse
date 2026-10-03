// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Election } from '../types';

const svc = vi.hoisted(() => ({
  getElections: vi.fn(),
  createElection: vi.fn(),
  updateElection: vi.fn(async () => ({})),
  finalizeElection: vi.fn(async () => ({})),
}));
vi.mock('../services/election.service', () => svc);
vi.mock('../services/geo.service', () => ({ getStates: vi.fn(async () => [{ id: 1, name: 'Bihar', code: 'BR' }]) }));
const ctx = vi.hoisted(() => ({ reload: vi.fn(async () => {}), setElectionId: vi.fn(), elections: [] as Election[], error: null as string | null }));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({ elections: ctx.elections, electionId: 'e1', election: null, setElectionId: ctx.setElectionId, loading: false, error: ctx.error, reload: ctx.reload }),
}));
const auth = vi.hoisted(() => ({ role: 'EDITOR' }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: auth.role, email: 'x' }, hasRole: (...r: string[]) => r.includes(auth.role) }),
}));
import Elections from './Elections';
import { renderEntityPage } from '../test-utils/entity-harness';

const E = (id: string, name: string, type: 'LS' | 'VS', status: Election['status']): Election => ({
  id, name, type, state_id: type === 'VS' ? 1 : null, year: 2025, status, tentative_next_date: null, delimitation: null, manifest_url: null,
});
const ELECTIONS = [E('e1', 'Bihar Vidhan Sabha 2025', 'VS', 'Upcoming'), E('e2', 'Lok Sabha 2024', 'LS', 'Live'), E('e3', 'Kerala Vidhan Sabha 2026', 'VS', 'Upcoming')];

beforeEach(() => {
  ctx.elections = ELECTIONS;
  ctx.error = null;
  auth.role = 'EDITOR';
  svc.getElections.mockImplementation(async (f?: { type?: string; status?: string }) =>
    ELECTIONS.filter((e) => (!f?.type || e.type === f.type) && (!f?.status || e.status === f.status)));
  svc.createElection.mockImplementation(async () => ELECTIONS[2]);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/elections') => renderEntityPage('/elections', <Elections />, at);
const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Elections' });

describe('Elections page', () => {
  it('lists elections with sentence-case status and opens one in the panel', async () => {
    renderAt();
    expect(await within(table()).findByText('Lok Sabha 2024')).toBeTruthy();
    expect(within(table()).getByText('Live')).toBeTruthy();
    fireEvent.click(within(table()).getByText('Bihar Vidhan Sabha 2025'));
    expect(where()).toBe('/elections/e1');
    const panel = screen.getByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Bihar Vidhan Sabha 2025');
    // The state options arrive with getStates; a controlled <select> reads '' until its option exists.
    await waitFor(() => expect((within(panel).getByLabelText('State') as HTMLSelectElement).value).toBe('1'));
  });

  it('Go live asks first, then sets the status and reloads the top-bar list', async () => {
    renderAt('/elections/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Go live' }));
    const confirm = screen.getByRole('dialog', { name: 'Go live?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Go live' }));
    await waitFor(() => expect(svc.updateElection).toHaveBeenCalledWith('e1', { status: 'Live' }));
    await waitFor(() => expect(ctx.reload).toHaveBeenCalled());
  });

  it('an EDITOR never sees Finalize', async () => {
    renderAt('/elections/e2');
    await screen.findByRole('dialog', { name: 'Lok Sabha 2024' });
    expect(screen.queryByRole('button', { name: 'Finalize' })).toBeNull();
  });

  it('a SUPER_ADMIN can finalize a live election after confirming', async () => {
    auth.role = 'SUPER_ADMIN';
    renderAt('/elections/e2');
    const panel = await screen.findByRole('dialog', { name: 'Lok Sabha 2024' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Finalize' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Finalize election?' })).getByRole('button', { name: 'Yes, finalize' }));
    await waitFor(() => expect(svc.finalizeElection).toHaveBeenCalledWith('e2'));
  });

  it('a deep link opens the election even when the table filter hides it', async () => {
    localStorage.setItem('elections_filters', JSON.stringify({ status: '', type: 'LS', stateId: null }));
    renderAt('/elections/e1');
    // The edit dialog is modal, so the table behind it is aria-hidden.
    const hiddenTable = () => screen.getByRole('table', { name: 'Elections', hidden: true });
    await within(hiddenTable()).findByText('Lok Sabha 2024');
    expect(within(hiddenTable()).queryByText('Bihar Vidhan Sabha 2025')).toBeNull();
    const panel = screen.getByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Bihar Vidhan Sabha 2025');
  });

  it('New election creates, waits for the reload, then shows the new record', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'New election' }));
    expect(where()).toBe('/elections/new');
    const panel = screen.getByRole('dialog', { name: 'New election' });
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Kerala Vidhan Sabha 2026' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create election' }));
    await waitFor(() => expect(svc.createElection).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kerala Vidhan Sabha 2026' })));
    await waitFor(() => expect(where()).toBe('/elections/e3'));
    expect(ctx.reload).toHaveBeenCalled();
  });

  it('pressing Enter in the create form submits it', async () => {
    renderAt('/elections/new');
    const panel = await screen.findByRole('dialog', { name: 'New election' });
    const name = within(panel).getByLabelText('Name');
    fireEvent.change(name, { target: { value: 'Kerala Vidhan Sabha 2026' } });
    fireEvent.submit(name.closest('form')!);
    await waitFor(() => expect(svc.createElection).toHaveBeenCalled());
  });

  it('a bad year shows an inline error and blocks Save', async () => {
    renderAt('/elections/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    fireEvent.change(within(panel).getByLabelText('Year'), { target: { value: '20' } });
    expect(within(panel).getByText('Enter a 4-digit year')).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('tells "not found" apart from a failed list load, and Try again reloads', async () => {
    renderAt('/elections/zzz');
    expect(await screen.findByText('Election not found')).toBeTruthy();
    cleanup();
    ctx.elections = [];
    ctx.error = 'Could not load elections';
    renderAt('/elections/e1');
    expect(await screen.findByText('Could not load election')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(ctx.reload).toHaveBeenCalled();
  });

  it('shows year, next date, manifest and the current election in the table', async () => {
    ctx.elections = ELECTIONS.map((e) => (e.id === 'e2' ? { ...e, manifest_url: 'https://cdn/x.json', tentative_next_date: '2029-04-15' } : e));
    svc.getElections.mockImplementation(async () => ctx.elections);
    renderAt();
    const row = (await within(table()).findByText('Lok Sabha 2024')).closest('tr')!;
    expect(within(row).getByText('Published')).toBeTruthy();
    expect(within(row).getByText('15 Apr 2029')).toBeTruthy();
    const current = within(table()).getByText('Bihar Vidhan Sabha 2025').closest('tr')!;
    expect(within(current).getByText('Current')).toBeTruthy();
    expect(within(current).getByText('Not published')).toBeTruthy();
  });

  it('Go live from the row asks first and does not open the edit dialog', async () => {
    renderAt();
    const row = (await within(table()).findByText('Kerala Vidhan Sabha 2026')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Go live' }));
    expect(where()).toBe('/elections');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Go live?' })).getByRole('button', { name: 'Go live' }));
    await waitFor(() => expect(svc.updateElection).toHaveBeenCalledWith('e3', { status: 'Live' }));
  });

  it('Finalize in the row is for a SUPER_ADMIN only', async () => {
    renderAt();
    const row = (await within(table()).findByText('Lok Sabha 2024')).closest('tr')!;
    expect(within(row).queryByRole('button', { name: 'Finalize' })).toBeNull();
    cleanup();
    auth.role = 'SUPER_ADMIN';
    renderAt();
    const row2 = (await within(table()).findByText('Lok Sabha 2024')).closest('tr')!;
    fireEvent.click(within(row2).getByRole('button', { name: 'Finalize' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Finalize election?' })).getByRole('button', { name: 'Yes, finalize' }));
    await waitFor(() => expect(svc.finalizeElection).toHaveBeenCalledWith('e2'));
  });

  it('the ⋯ menu makes an election current without opening the edit dialog', async () => {
    renderAt();
    await within(table()).findByText('Lok Sabha 2024');
    const trigger = screen.getByRole('button', { name: 'More actions for Lok Sabha 2024' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Make current' }));
    expect(ctx.setElectionId).toHaveBeenCalledWith('e2');
    expect(where()).toBe('/elections');
  });

  it('⋯ Open live console switches the global election before navigating', async () => {
    renderAt();
    await within(table()).findByText('Lok Sabha 2024');
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions for Lok Sabha 2024' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Open live console' }));
    expect(ctx.setElectionId).toHaveBeenCalledWith('e2');
    await waitFor(() => expect(where()).toBe('/overrides?election=e2'));
  });

  it('⋯ Open manifest switches the global election before navigating', async () => {
    renderAt();
    await within(table()).findByText('Kerala Vidhan Sabha 2026');
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions for Kerala Vidhan Sabha 2026' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Open manifest' }));
    expect(ctx.setElectionId).toHaveBeenCalledWith('e3');
    await waitFor(() => expect(where()).toBe('/manifests/e3?election=e3'));
  });

  it('⋯ Open manifest on the current election does not switch', async () => {
    renderAt();
    await within(table()).findByText('Bihar Vidhan Sabha 2025');
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions for Bihar Vidhan Sabha 2025' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Open manifest' }));
    expect(ctx.setElectionId).not.toHaveBeenCalled();
    await waitFor(() => expect(where()).toBe('/manifests/e1?election=e1'));
  });
});
