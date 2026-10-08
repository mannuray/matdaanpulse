// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { move, saveSeat, releaseHold, lockState, page } = vi.hoisted(() => ({
  page: { electionId: 'e1', electionsError: null as string | null, feedError: null as string | null, holds: [] as any[], seat: null as string | null },
  releaseHold: vi.fn(async () => undefined),
  move: vi.fn(),
  saveSeat: vi.fn(async () => true),
  lockState: { value: { state: 'held', holder: null as any, takeOver: vi.fn() } },
}));
const seat = {
  const_id: 's2', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24,
  candidates: [
    { result_id: 'a', candidate_id: 'ca', candidate_name: 'Ravi Prasad', party_id: 'BJP', party_name: 'BJP', party_color: '#f59e0b', party_abbr: 'BJP', votes: 61204, status: 'LEADING', margin: 0, last_updated: '' },
    { result_id: 'b', candidate_id: 'cb', candidate_name: 'Anil Kumar', party_id: 'INC', party_name: 'INC', party_color: '#0ea5e9', party_abbr: 'INC', votes: 48990, status: 'TRAILING', margin: 0, last_updated: '' },
  ],
};
vi.mock('../hooks/useLiveConsole', () => ({
  useLiveConsole: () => ({
    electionId: page.electionId, electionsError: page.electionsError, electionName: 'Bihar VS 2025', loading: false, saving: false,
    seats: [seat], counts: { all: 1, PENDING: 0, LEADING: 1, WON: 0 }, filter: 'all', setFilter: vi.fn(),
    search: '', setSearch: vi.fn(), selectedId: 's2', selected: page.seat ? { ...seat, seat_state: page.seat } : seat, select: vi.fn(), move,
    locks: {}, flashIds: new Set(), reportingPct: 100, saveSeat, lastSavedAt: {},
    holds: page.holds, releaseHold,
  }),
}));
vi.mock('../hooks/useIngestFeed', () => ({
  useIngestFeed: () => ({ status: null, sources: [], error: page.feedError, saving: false, setFeed: vi.fn(), reload: vi.fn() }),
}));
vi.mock('../hooks/useSeatLock', () => ({ useSeatLock: () => lockState.value }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', name: 'Mannu K' } }) }));
import LiveConsole from './LiveConsole';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { useUnsavedEdits } from '../context/UnsavedEditsContext';

function DirtyProbe() { return <output data-testid="dirty">{String(useUnsavedEdits().editorDirty)}</output>; }
// The page reports unsaved edits to the shell (sidebar/picker guards), so render it inside the real provider.
const renderPage = (page = <LiveConsole />) => render(<ShellStatusProvider>{page}<DirtyProbe /></ShellStatusProvider>);

beforeEach(() => {
  lockState.value = { state: 'held', holder: null, takeOver: vi.fn() };
  page.electionId = 'e1';
  page.electionsError = null;
  page.feedError = null;
  page.holds = [];
  page.seat = null;
});
afterEach(() => { cleanup(); move.mockClear(); saveSeat.mockClear(); vi.restoreAllMocks(); });

describe('LiveConsole page', () => {
  it('shows the seat with calculated margin and sentence-case actions', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /142 Patna Sahib/ })).toBeTruthy();
    expect(screen.getByText('+12,214')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save seat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Declare won' })).toBeTruthy();
  });

  it('↑/↓ move seats only when focus is not in an input', () => {
    renderPage();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(move).toHaveBeenCalledWith(1);
    move.mockClear();
    const votes = screen.getByLabelText('Votes for Ravi Prasad');
    votes.focus();
    fireEvent.keyDown(votes, { key: 'ArrowDown' });
    expect(move).not.toHaveBeenCalled();
  });

  it('Save seat sends the seat state, rounds and votes by candidate id', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Votes for Anil Kumar'), { target: { value: '50,000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save seat' }));
    await Promise.resolve();
    expect(saveSeat).toHaveBeenCalledWith('s2', {
      state: 'counting', round: { current: 4, total: 24 }, votes: { ca: 61204, cb: 50000 },
    });
  });

  it('Enter inside the editor saves; Enter on a button or outside does not', () => {
    renderPage();
    const votes = screen.getByLabelText('Votes for Ravi Prasad');
    fireEvent.change(votes, { target: { value: '61205' } }); // a clean seat has nothing to save (M-3)
    votes.focus();
    fireEvent.keyDown(votes, { key: 'Enter' });
    expect(saveSeat).toHaveBeenCalledTimes(1);
    saveSeat.mockClear();
    const btn = screen.getByRole('button', { name: 'Declare won' });
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(saveSeat).not.toHaveBeenCalled();
    screen.getByLabelText('Jump to seat').focus();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(saveSeat).not.toHaveBeenCalled();
  });

  it('Esc inside the editor discards; Esc outside does not', () => {
    renderPage();
    const votes = screen.getByLabelText('Votes for Anil Kumar') as HTMLInputElement;
    const original = votes.value;
    fireEvent.change(votes, { target: { value: '50,000' } });
    expect(votes.value).toBe('50,000');
    screen.getByLabelText('Jump to seat').focus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(votes.value).toBe('50,000');
    votes.focus();
    fireEvent.keyDown(votes, { key: 'Escape' });
    expect(votes.value).toBe(original);
  });

  it('/ focuses the seat search', () => {
    renderPage();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(screen.getByLabelText('Jump to seat'));
  });

  it('moving with unsaved edits asks first and false blocks the move', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    fireEvent.change(screen.getByLabelText('Votes for Anil Kumar'), { target: { value: '50,000' } });
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(move).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(move).toHaveBeenCalledWith(1);
  });

  it('a locked seat is read only', () => {
    lockState.value = { state: 'locked', holder: { const_id: 's2', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' }, takeOver: vi.fn() };
    renderPage();
    for (const l of ['Votes for Ravi Prasad', 'Votes for Anil Kumar', 'Seat state', 'Current round', 'Total rounds']) {
      expect((screen.getByLabelText(l) as HTMLInputElement).disabled).toBe(true);
    }
    expect((screen.getByRole('button', { name: 'Save seat' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Declare won' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Take over' })).toBeTruthy();
    expect(screen.getByText(/Priya S/)).toBeTruthy();
    const votes = screen.getByLabelText('Votes for Ravi Prasad');
    votes.focus();
    fireEvent.keyDown(votes, { key: 'Enter' });
    expect(saveSeat).not.toHaveBeenCalled();
  });

  it('Save seat is disabled while the seat is clean, enabled after an edit', () => {
    renderPage();
    const save = () => screen.getByRole('button', { name: 'Save seat' }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Votes for Anil Kumar'), { target: { value: '50,000' } });
    expect(save().disabled).toBe(false);
  });

  it('Declare won asks first; cancel saves nothing, confirming declares the leader and saves', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Declare won' }));
    const dialog = screen.getByRole('dialog', { name: 'Declare Ravi Prasad the winner?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(saveSeat).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Declare won' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, declare won' }));
    await waitFor(() => expect(saveSeat).toHaveBeenCalledTimes(1));
    expect(saveSeat).toHaveBeenCalledWith('s2', expect.objectContaining({ state: 'declared', votes: { ca: 61204, cb: 48990 } }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('arrow keys already handled by a widget, or pressed inside a listbox/menu/dialog, do not move seats', () => {
    renderPage();
    const widget = document.createElement('div');
    widget.tabIndex = 0;
    widget.addEventListener('keydown', (e) => e.preventDefault());
    document.body.appendChild(widget);
    fireEvent.keyDown(widget, { key: 'ArrowDown' });
    expect(move).not.toHaveBeenCalled();
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    const option = document.createElement('div');
    option.tabIndex = 0;
    listbox.appendChild(option);
    document.body.appendChild(listbox);
    option.focus();
    fireEvent.keyDown(option, { key: 'ArrowUp' });
    expect(move).not.toHaveBeenCalled();
    widget.remove();
    listbox.remove();
  });

  it('unsaved edits are reported to the shell and arm the tab-close warning; unmount clears them', () => {
    const { unmount } = render(<ShellStatusProvider><LiveConsoleToggle /><DirtyProbe /></ShellStatusProvider>);
    const unload = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
    expect(unload()).toBe(false);
    fireEvent.change(screen.getByLabelText('Votes for Anil Kumar'), { target: { value: '50,000' } });
    expect(screen.getByTestId('dirty').textContent).toBe('true');
    expect(unload()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Hide page' }));
    expect(screen.getByTestId('dirty').textContent).toBe('false');
    expect(unload()).toBe(false);
    unmount();
  });

  it('seat state select sends the chosen state; rows have no status pickers', async () => {
    renderPage();
    expect(screen.queryByLabelText('Status for Ravi Prasad')).toBeNull();
    fireEvent.change(screen.getByLabelText('Seat state'), { target: { value: 'countermanded' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save seat' }));
    await Promise.resolve();
    expect(saveSeat).toHaveBeenCalledWith('s2', expect.objectContaining({ state: 'countermanded' }));
  });

  it('a seat whose server state is countermanded opens as Countermanded and a votes-only save keeps it', async () => {
    page.seat = 'countermanded';
    renderPage();
    expect((screen.getByLabelText('Seat state') as HTMLSelectElement).value).toBe('countermanded');
    fireEvent.change(screen.getByLabelText('Votes for Anil Kumar'), { target: { value: '50,000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save seat' }));
    await Promise.resolve();
    expect(saveSeat).toHaveBeenCalledWith('s2', expect.objectContaining({ state: 'countermanded' }));
  });

  it('shows the hold line for the selected seat and the holds panel releases', () => {
    page.holds = [{ const_id: 's2', const_no: 142, name: 'Patna Sahib', round_at_hold: 4, expires_at: new Date(Date.now() + 600_000).toISOString(), created_by_name: 'Asha' }];
    renderPage();
    expect(screen.getByText(/On hold until .* \(IST\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Release #142 Patna Sahib' }));
    expect(releaseHold).toHaveBeenCalledWith('s2');
  });

  it('without a hold for the seat there is no hold line', () => {
    renderPage();
    expect(screen.queryByText(/On hold until/)).toBeNull();
  });

  it('shows a feed refresh error without hiding the console', () => {
    page.feedError = 'Network down';
    renderPage();
    expect(screen.getByText('Feed status could not be refreshed: Network down')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save seat' })).toBeTruthy();
  });

  it('shows a load error instead of "pick an election" when elections fail to load', () => {
    page.electionId = '';
    page.electionsError = 'Could not load elections';
    renderPage();
    expect(screen.getByText('Could not load elections. Check the connection and reload.')).toBeTruthy();
    expect(screen.queryByText(/Pick an election/)).toBeNull();
  });
});

function LiveConsoleToggle() {
  const [shown, setShown] = useState(true);
  return <>{shown && <LiveConsole />}<button type="button" onClick={() => setShown(false)}>Hide page</button></>;
}
