// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '../../i18n';
import { RegionsTab } from '../dashboard/RegionsTab';
import { StandingsTile } from '../dashboard/StandingsTile';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';
import type { RegionComparisonVM } from '../../viewmodels/tiles/useRegionComparisonVM';

afterEach(cleanup);
const noop = () => {};
const standings: StandingsVM = { rows: [{ id: 'BJP', name: 'Party', color: '#fff', seats: 3, votePct: null, allianceId: null }], allRows: [], pulse: false, lockedId: null, onFocus: noop, onHoverParty: noop, onLockParty: noop, markOf: () => null, onOpenParty: noop };
const regions: RegionComparisonVM = { prevYear: 2021, curYear: 2026, rows: [
  { name: 'Statewide', seats: [126, 126], groups: [{ id: 'NDA', label: 'NDA', color: '#f80', share: [44.5, 48], won: [75, 102] }] },
  { name: 'Hills', seats: [5, 6], groups: [{ id: 'ASM', label: 'Congress+', color: '#19a', share: [null, 20.5], won: [0, 0] }] },
] };

describe('RegionsTab', () => {
  it('shows each row with previous → current share and seats, and the approximation note', () => {
    render(<RegionsTab vm={regions} />);
    expect(screen.getByText('44.5% → 48%')).toBeTruthy();
    expect(screen.getByText('75 → 102')).toBeTruthy();
    expect(screen.getByText('— → 20.5%')).toBeTruthy();
    expect(screen.getByText(/approximate/)).toBeTruthy();
  });
});

describe('StandingsTile regions tab', () => {
  it('offers Regions only when the election has a region comparison', () => {
    const { rerender } = render(<StandingsTile vm={standings} variant="tile" />);
    expect(screen.queryByRole('radio', { name: 'Regions' }) ?? screen.queryByText('Regions')).toBeNull();
    rerender(<StandingsTile vm={standings} variant="tile" regions={regions} />);
    fireEvent.click(screen.getByText('Regions'));
    expect(screen.getByText('Regions vs 2021')).toBeTruthy();
    expect(screen.getByText('Hills')).toBeTruthy();
  });
});
