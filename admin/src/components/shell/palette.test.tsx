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
  useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: 'EDITOR', email: 'x' }, logout: vi.fn(), hasRole: (...r: string[]) => r.some((x) => roleState.roles.includes(x)) }),
}));
const shell = vi.hoisted(() => ({ editorDirty: false }));
const roleState = vi.hoisted(() => ({ roles: ['EDITOR'] as string[] }));
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

beforeEach(() => { order.length = 0; shell.editorDirty = false; roleState.roles = ['EDITOR']; });
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

describe('CommandPalette — scope and freshness', () => {
  it('selected-election candidates missing from the all-elections response still come first, de-duplicated', async () => {
    search.searchCandidatesAll.mockImplementation(async (_q: string, e?: string) => (e
      ? [{ id: 'h1', name: 'Hari Here', election_id: 'e1', const_id: 's1', party_id: 'BJP' }, { id: 'c7', name: 'Ravi Prasad', election_id: 'e2', const_id: 'k5', party_id: 'BJP' }]
      : [{ id: 'c7', name: 'Ravi Prasad', election_id: 'e2', const_id: 'k5', party_id: 'BJP' }]));
    renderPalette();
    fireEvent.change(input(), { target: { value: 'ra' } });
    await screen.findByRole('option', { name: /Hari Here/ });
    expect(search.searchCandidatesAll).toHaveBeenCalledWith('ra', 'e1');
    const names = screen.getAllByRole('option').map((o) => o.textContent ?? '').filter((t) => /Hari|Ravi/.test(t));
    expect(names.length).toBe(2);
    expect(names[0]).toMatch(/Hari Here/);
    search.searchCandidatesAll.mockReset(); search.searchCandidatesAll.mockResolvedValue([]);
  });

  it('an EDITOR does not see Users, Audit logs or System status', () => {
    renderPalette();
    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    expect(labels).toContain('Parties');
    for (const hidden of ['Users', 'Audit logs', 'System status']) expect(labels).not.toContain(hidden);
  });

  it('a SUPER_ADMIN sees them', () => {
    roleState.roles = ['SUPER_ADMIN', 'EDITOR'];
    renderPalette();
    expect(screen.getByRole('option', { name: 'Users' })).toBeTruthy();
  });

  it('exposes combobox semantics', () => {
    renderPalette();
    const i = input();
    expect(i.getAttribute('role')).toBe('combobox');
    expect(i.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
    expect(i.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);
  });

  it('ignores a stale response that arrives after a newer query', async () => {
    vi.useFakeTimers();
    try {
      let resolveOld!: (v: unknown[]) => void;
      search.searchSeats.mockImplementationOnce(() => new Promise<unknown[]>((r) => { resolveOld = r; }));
      search.searchSeats.mockImplementationOnce(async () => [{ id: 'new', name: 'Newtown', const_no: 2, election_id: 'e1', type: 'GEN' }]);
      renderPalette();
      fireEvent.change(input(), { target: { value: 'ab' } });
      await vi.advanceTimersByTimeAsync(260);
      fireEvent.change(input(), { target: { value: 'abc' } });
      await vi.advanceTimersByTimeAsync(260);
      expect(screen.getByRole('option', { name: /Newtown/ })).toBeTruthy();
      resolveOld([{ id: 'old', name: 'Oldtown', const_no: 1, election_id: 'e1', type: 'GEN' }]);
      await vi.advanceTimersByTimeAsync(10);
      expect(screen.queryByRole('option', { name: /Oldtown/ })).toBeNull();
      expect(screen.getByRole('option', { name: /Newtown/ })).toBeTruthy();
    } finally { vi.useRealTimers(); }
  });
});


describe('TopBar search', () => {
  const open = () => screen.getByLabelText(/Search seats, candidates/);
  it('Cmd+K on macOS, Ctrl+K elsewhere, and the search field open the palette', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    expect(screen.queryByLabelText(/Search seats, candidates/)).toBeNull();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.queryByLabelText(/Search seats, candidates/)).toBeNull();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(open()).toBeTruthy();
    fireEvent.keyDown(open(), { key: 'Escape' });
    expect(screen.queryByLabelText(/Search seats, candidates/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Search (⌘K)' }));
    expect(open()).toBeTruthy();
  });

  it('ignores Ctrl+Shift+K, Alt, key repeat and IME composition; Ctrl+K opens on non-Mac', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    for (const extra of [{ shiftKey: true }, { altKey: true }, { repeat: true }, { isComposing: true }, { metaKey: true }]) {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true, ...extra });
      expect(screen.queryByLabelText(/Search seats, candidates/)).toBeNull();
    }
    fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    expect(open()).toBeTruthy();
  });
});
