// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '../../i18n';
import { PartyDialog } from '../party/PartyDialog';
import type { PartyDialogVM } from '../../viewmodels/tiles/usePartyDialogVM';

beforeAll(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never; });
afterEach(cleanup);

const vm = (over: Partial<PartyDialogVM> = {}): PartyDialogVM => ({
  id: 'RJD', name: 'Rashtriya Janata Dal', abbreviation: 'RJD', mark: '/r.svg', color: '#0a0', recognition: 'State', electionName: 'Bihar Vidhan Sabha 2025',
  stats: { won: 52, leading: 23, contested: 143, votePct: 23.1, alliance: { id: 'MGB', name: 'Mahagathbandhan' } }, totalSeats: 243, majority: 122,
  profile: { leader: 'Tejashwi Yadav', founded: 1997, hq: null, website: 'https://rjd.co.in', wikipedia: null, description: null },
  keyCandidates: [{ key: 'k', name: 'Tejashwi Yadav', constId: 'S', constName: 'Raghopur', partyId: 'RJD', status: 'WON', margin: 10, custom: false }],
  onClose: vi.fn(), onSelectSeat: vi.fn(), ...over,
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
});
