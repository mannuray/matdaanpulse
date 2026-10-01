// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const move = vi.fn();
const saveSeat = vi.fn(async () => true);
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
vi.mock('../hooks/useSeatLock', () => ({ useSeatLock: () => ({ state: 'held', holder: null, takeOver: vi.fn() }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', name: 'Mannu K' } }) }));
import LiveConsole from './LiveConsole';

afterEach(() => { cleanup(); move.mockClear(); saveSeat.mockClear(); });

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
});
