// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { move, saveSeat, lockState } = vi.hoisted(() => ({
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
    electionId: 'e1', electionName: 'Bihar VS 2025', loading: false, saving: false,
    seats: [seat], counts: { all: 1, PENDING: 0, LEADING: 1, WON: 0 }, filter: 'all', setFilter: vi.fn(),
    search: '', setSearch: vi.fn(), selectedId: 's2', selected: seat, select: vi.fn(), move,
    locks: {}, flashIds: new Set(), reportingPct: 100, saveSeat, lastSavedAt: {},
  }),
}));
vi.mock('../hooks/useSeatLock', () => ({ useSeatLock: () => lockState.value }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', name: 'Mannu K' } }) }));
import LiveConsole from './LiveConsole';

beforeEach(() => { lockState.value = { state: 'held', holder: null, takeOver: vi.fn() }; });
afterEach(() => { cleanup(); move.mockClear(); saveSeat.mockClear(); vi.restoreAllMocks(); });

describe('LiveConsole page', () => {
  it('shows the seat with calculated margin and sentence-case actions', () => {
    render(<LiveConsole />);
    expect(screen.getByRole('heading', { name: /142 Patna Sahib/ })).toBeTruthy();
    expect(screen.getByText('+12,214')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save seat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Declare won' })).toBeTruthy();
  });

  it('↑/↓ move seats only when focus is not in an input', () => {
    render(<LiveConsole />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(move).toHaveBeenCalledWith(1);
    move.mockClear();
    const votes = screen.getByLabelText('Votes for Ravi Prasad');
    votes.focus();
    fireEvent.keyDown(votes, { key: 'ArrowDown' });
    expect(move).not.toHaveBeenCalled();
  });

  it('Save seat sends the whole seat with margins', async () => {
    render(<LiveConsole />);
    fireEvent.change(screen.getByLabelText('Votes for Anil Kumar'), { target: { value: '50,000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save seat' }));
    await Promise.resolve();
    expect(saveSeat).toHaveBeenCalledWith('s2', expect.objectContaining({
      overrides: [
        { result_id: 'a', votes: 61204, status: 'LEADING', margin: 11204 },
        { result_id: 'b', votes: 50000, status: 'TRAILING', margin: 11204 },
      ],
    }));
  });

  it('Enter inside the editor saves; Enter on a button or outside does not', () => {
    render(<LiveConsole />);
    const votes = screen.getByLabelText('Votes for Ravi Prasad');
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
    render(<LiveConsole />);
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
    render(<LiveConsole />);
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(screen.getByLabelText('Jump to seat'));
  });

  it('moving with unsaved edits asks first and false blocks the move', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<LiveConsole />);
    fireEvent.change(screen.getByLabelText('Votes for Anil Kumar'), { target: { value: '50,000' } });
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(confirm).toHaveBeenCalledWith('Discard unsaved edits for this seat?');
    expect(move).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(move).toHaveBeenCalledWith(1);
  });

  it('a locked seat is read only', () => {
    lockState.value = { state: 'locked', holder: { const_id: 's2', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' }, takeOver: vi.fn() };
    render(<LiveConsole />);
    for (const l of ['Votes for Ravi Prasad', 'Votes for Anil Kumar', 'Status for Ravi Prasad', 'Current round', 'Total rounds']) {
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
});
