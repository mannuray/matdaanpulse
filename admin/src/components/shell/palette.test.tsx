// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const search = vi.hoisted(() => ({
  searchSeats: vi.fn(async (_q: string, _e: string): Promise<unknown[]> => []),
  searchCandidatesAll: vi.fn(async (_q: string): Promise<unknown[]> => []),
}));
vi.mock('../../services/search.service', () => search);
vi.mock('../../services/geo.service', () => ({
  getPartiesPaginated: vi.fn(async () => ({ success: true, data: [{ id: 'BJP', name: 'Bharatiya Janata Party' }], pagination: { page: 1, limit: 6, total: 1, totalPages: 1 } })),
}));
vi.mock('../../services/person.api', () => ({
  getPersons: vi.fn(async () => ({ success: true, data: [], pagination: { page: 1, limit: 6, total: 0, totalPages: 1 } })),
}));
const ctx = vi.hoisted(() => ({
  setElectionId: vi.fn(),
  elections: [
    { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live', state_id: 1, tentative_next_date: null, manifest_url: null },
    { id: 'e2', name: 'Kerala Vidhan Sabha 2021', type: 'VS', year: 2021, status: 'Finalized', state_id: 2, tentative_next_date: null, manifest_url: null },
  ],
}));
vi.mock('../../context/ElectionContext', () => ({ useElection: () => ({ electionId: 'e1', elections: ctx.elections, setElectionId: ctx.setElectionId }) }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: 'EDITOR', email: 'x' }, logout: vi.fn(), hasRole: (...r: string[]) => r.includes('EDITOR') }),
}));
const shell = vi.hoisted(() => ({ editorDirty: false }));
vi.mock('../../context/ShellStatusContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../context/ShellStatusContext')>()),
  useShellStatus: () => ({ live: 'idle', setLive: () => {}, editorDirty: shell.editorDirty, markDirty: () => {} }),
}));
import { CommandPalette } from './CommandPalette';
import { TopBar } from './TopBar';

const order: string[] = [];
function Where() {
  const { pathname, search: qs } = useLocation();
  useEffect(() => { order.push(`nav:${pathname}${qs}`); }, [pathname, qs]);
  return <output data-testid="where">{pathname + qs}</output>;
}
const renderPalette = (onOpenChange = vi.fn()) => render(
  <MemoryRouter initialEntries={['/parties?election=e1']}><CommandPalette open onOpenChange={onOpenChange} /><Where /></MemoryRouter>,
);
const input = () => screen.getByLabelText(/Search seats, candidates/);

beforeEach(() => { order.length = 0; shell.editorDirty = false; });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('CommandPalette', () => {
  it('finds seats in this election and candidates anywhere; a candidate from another election switches election, then opens', async () => {
    ctx.setElectionId.mockImplementation((id: string) => { order.push(`election:${id}`); });
    search.searchSeats.mockResolvedValue([{ id: 's142', name: 'Patna Sahib', const_no: 142, election_id: 'e1', type: 'GEN' }]);
    search.searchCandidatesAll.mockResolvedValue([
      { id: 'c7', name: 'Ravi Prasad', election_id: 'e2', const_id: 'k5', party_id: 'BJP' },
      { id: 'n1', name: 'NOTA', election_id: 'e1', const_id: 's1', party_id: 'NOTA' },
    ]);
    const onOpenChange = vi.fn();
    renderPalette(onOpenChange);
    fireEvent.change(input(), { target: { value: 'pat' } });
    expect(await screen.findByRole('option', { name: /142 Patna Sahib/ })).toBeTruthy();
    expect(search.searchSeats).toHaveBeenCalledWith('pat', 'e1');
    expect(screen.queryByRole('option', { name: /NOTA/ })).toBeNull();
    order.length = 0;
    fireEvent.click(screen.getByRole('option', { name: /Ravi Prasad/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(order).toEqual(['election:e2', 'nav:/candidates/c7?election=e2']);
  });

  it('a seat opens the constituency panel in the current election', async () => {
    search.searchSeats.mockResolvedValue([{ id: 'BR_VS2025_PATNA', name: 'Patna Sahib', const_no: 142, election_id: 'e1', type: 'GEN' }]);
    renderPalette();
    fireEvent.change(input(), { target: { value: 'patna' } });
    fireEvent.click(await screen.findByRole('option', { name: /142 Patna Sahib/ }));
    expect(ctx.setElectionId).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/constituencies/BR_VS2025_PATNA?election=e1');
  });

  it('with unsaved edits, picking a result asks first and cancel stays put', async () => {
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onOpenChange = vi.fn();
    renderPalette(onOpenChange);
    fireEvent.change(input(), { target: { value: 'par' } });
    fireEvent.click(screen.getByRole('option', { name: 'Parties' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/parties?election=e1');
  });

  it('one letter only filters pages (no API call); ↓ + Enter opens the highlighted page', async () => {
    renderPalette();
    fireEvent.change(input(), { target: { value: 'p' } });
    await new Promise((r) => setTimeout(r, 300));
    expect(search.searchSeats).not.toHaveBeenCalled();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Parties', 'Persons']);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/persons?election=e1'));
  });
});

describe('TopBar search', () => {
  it('⌘K / Ctrl+K and the search field open the palette', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    expect(screen.queryByLabelText(/Search seats, candidates/)).toBeNull();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByLabelText(/Search seats, candidates/)).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText(/Search seats, candidates/), { key: 'Escape' });
    expect(screen.queryByLabelText(/Search seats, candidates/)).toBeNull();
    fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    expect(screen.getByLabelText(/Search seats, candidates/)).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText(/Search seats, candidates/), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Search (⌘K)' }));
    expect(screen.getByLabelText(/Search seats, candidates/)).toBeTruthy();
  });
});
