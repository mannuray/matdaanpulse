// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render as rtlRender, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { PartyDialog } from '../party/PartyDialog';
import type { PartyDialogVM } from '../../viewmodels/tiles/usePartyDialogVM';

/** Dialogs carry the site footer (router links). */
const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

beforeAll(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never; });
afterEach(cleanup);

const vm = (over: Partial<PartyDialogVM> = {}): PartyDialogVM => ({
  id: 'RJD', name: 'Rashtriya Janata Dal', abbreviation: 'RJD', mark: '/r.svg', color: '#0a0', recognition: 'State', electionName: 'Bihar Vidhan Sabha 2025',
  stats: { won: 52, leading: 23, contested: 143, votePct: 23.1, alliance: { id: 'MGB', name: 'Mahagathbandhan' } }, totalSeats: 243, majority: 122,
  profile: { leader: 'Tejashwi Yadav', founded: 1997, hq: null, website: 'https://rjd.co.in', wikipedia: null, description: null },
  keyCandidates: [{ key: 'k', name: 'Tejashwi Yadav', constId: 'S', constName: 'Raghopur', constNo: 128, status: 'WON', margin: 10, leader: true, photo: null, tracked: false }, { key: 'n', name: 'Lalu Prasad Yadav', constId: '', constName: '', constNo: null, status: null, margin: null, leader: true, photo: null, tracked: false }],
  onClose: vi.fn(), onSelectSeat: vi.fn(), onToggleTrack: vi.fn(), ...over,
});

describe('PartyDialog', () => {
  it('shows mark, recognition, this election, the non-empty profile fields and key candidates', () => {
    const v = vm();
    render(<PartyDialog vm={v} />);
    expect(screen.getByRole('dialog', { name: 'Rashtriya Janata Dal' })).toBeTruthy();
    expect(screen.getByText('State party')).toBeTruthy();
    expect(screen.getByText('52')).toBeTruthy();
    expect(screen.getByText('23.1%')).toBeTruthy();
    expect(screen.getByText('1997')).toBeTruthy();
    expect(screen.getByText('Mahagathbandhan')).toBeTruthy();
    expect(screen.queryByText('Headquarters')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Tejashwi Yadav/ }));
    expect(v.onSelectSeat).toHaveBeenCalledWith('S');
  });

  it('hides the profile and key candidates when there are none', () => {
    render(<PartyDialog vm={vm({ profile: null, keyCandidates: [] })} />);
    expect(screen.queryByText('Leader')).toBeNull();
    expect(screen.queryByText('Key candidates')).toBeNull();
  });
  it('a leader without a seat is a plain card marked party leader / not contesting', () => {
    render(<PartyDialog vm={vm()} />);
    expect(screen.queryByRole('button', { name: /Lalu Prasad Yadav/ })).toBeNull();
    expect(screen.getByText('Not contesting this election')).toBeTruthy();
    expect(screen.getAllByText('Party leader')).toHaveLength(2);
  });
  it('a seat card has a track button; a seatless leader has none', () => {
    const v = vm();
    render(<PartyDialog vm={v} />);
    const track = screen.getByRole('button', { name: 'Track Raghopur' });
    expect(track.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(track);
    expect(v.onToggleTrack).toHaveBeenCalledWith('S', 'Raghopur');
    expect(v.onSelectSeat).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /^Track/ })).toHaveLength(1);
  });
  it('a tracked seat offers to stop tracking', () => {
    render(<PartyDialog vm={vm({ keyCandidates: [{ ...vm().keyCandidates[0], tracked: true }] })} />);
    expect(screen.getByRole('button', { name: 'Stop tracking Raghopur' }).getAttribute('aria-pressed')).toBe('true');
  });
});
