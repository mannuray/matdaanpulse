// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '../../i18n';
import { RegionsTab } from '../dashboard/RegionsTab';
import { StandingsTile } from '../dashboard/StandingsTile';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';
import type { RegionComparisonVM } from '../../viewmodels/tiles/useRegionComparisonVM';

afterEach(cleanup);
const noop = () => {};
const standings: StandingsVM = { rows: [{ id: 'BJP', name: 'Party', color: '#fff', seats: 3, votePct: null, allianceId: null }], allRows: [], pulse: false, lockedId: null, onFocus: noop, onHoverParty: noop, onLockParty: noop, markOf: () => null, onOpenParty: noop };
const vm = (over: Partial<RegionComparisonVM> = {}): RegionComparisonVM => ({ prevYear: 2021, curYear: 2026, approximate: false, mode: 'party', onMode: vi.fn(), rows: [
  { name: 'Statewide', seats: [126, 126], groups: [{ id: 'BJP', label: 'BJP', color: '#f80', share: [33.2, 37.8], won: [60, 82] }] },
  { name: 'Hills', seats: [5, 6], groups: [{ id: 'INC', label: 'INC', color: '#19a', share: [null, 20.5], won: [0, 0] }] },
], ...over });

describe('RegionsTab', () => {
  it('shows share, its change in points and seats, previous → current', () => {
    render(<RegionsTab vm={vm()} />);
    expect(screen.getByText('37.8%')).toBeTruthy();
    expect(screen.getByText('+4.6')).toBeTruthy();
    expect(screen.getByText('60 → 82')).toBeTruthy();
    expect(screen.queryByText(/approximate/)).toBeNull();
  });
  it('switches between party and alliance', () => {
    const v = vm();
    render(<RegionsTab vm={v} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Alliance' }));
    expect(v.onMode).toHaveBeenCalledWith('alliance');
  });
  it('notes an approximate comparison only after a redraw', () => {
    render(<RegionsTab vm={vm({ approximate: true })} />);
    expect(screen.getByText(/approximate/)).toBeTruthy();
  });
  it('shows this election only when there is no earlier one', () => {
    render(<RegionsTab vm={vm({ prevYear: null, rows: [{ name: 'Statewide', seats: [null, 243], groups: [{ id: 'BJP', label: 'BJP', color: '#f80', share: [null, 20.1], won: [null, 91] }] }] })} />);
    expect(screen.getByText(/No earlier election/)).toBeTruthy();
    expect(screen.getByText('20.1%')).toBeTruthy();
    expect(screen.getByText('91')).toBeTruthy();
  });
});

describe('StandingsTile regions tab', () => {
  it('offers Regions only when the election has a region comparison', () => {
    const { rerender } = render(<StandingsTile vm={standings} variant="tile" />);
    expect(screen.queryByText('Regions')).toBeNull();
    rerender(<StandingsTile vm={standings} variant="tile" regions={vm()} />);
    fireEvent.click(screen.getByText('Regions'));
    expect(screen.getByText('Regions vs 2021')).toBeTruthy();
    expect(screen.getByText('Hills')).toBeTruthy();
  });
});
