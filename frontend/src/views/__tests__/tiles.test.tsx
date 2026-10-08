// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n';
import { ScoreboardTile } from '../dashboard/ScoreboardTile';
import { StandingsTile } from '../dashboard/StandingsTile';
import { StatsStrip } from '../dashboard/StatsStrip';
import type { ScoreboardVM } from '../../viewmodels/tiles/useScoreboardVM';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';
import type { StatsVM } from '../../viewmodels/tiles/useStatsVM';

const noop = () => {};
const board: ScoreboardVM = {
  blocs: [{ id: 'NDA', name: 'NDA', color: '#FF7A1A', seats: 202, votePct: 48.1, kind: 'alliance', label: 'NDA', textColor: '#FF7A1A' }, { id: 'MGB', name: 'MGB', color: '#7BD34A', seats: 34, votePct: 37.1, kind: 'alliance', label: 'MGB', textColor: '#7BD34A' }],
  others: { seats: 7, votePct: 14.8 }, totalSeats: 243, majority: 122, countedSeats: 243, winnerId: 'NDA', marginOverMajority: 80,
  status: 'final', declared: 3, pulse: false, breakdown: [], lockedId: null, onFocus: noop, onHoverBloc: noop, onLockBloc: noop,
};

describe('dashboard tiles', () => {
  it('scoreboard shows real seat numbers and the majority marker', () => {
    render(<ScoreboardTile vm={board} variant="tile" />);
    expect(screen.getByText('202')).toBeTruthy();
    expect(screen.getByText('34')).toBeTruthy();
    expect(screen.getByText(/122/)).toBeTruthy();
  });

  it('standings rows lock a party on click', () => {
    const onLockParty = vi.fn();
    const vm: StandingsVM = { rows: [{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 89, votePct: null, allianceId: 'NDA' }], allRows: [], pulse: false, lockedId: null, onFocus: noop, onHoverParty: noop, onLockParty, markOf: () => null, onOpenParty: noop };
    render(<StandingsTile vm={vm} variant="tile" />);
    fireEvent.click(screen.getByRole('button', { name: /BJP/ }));
    expect(onLockParty).toHaveBeenCalledWith('BJP');
  });

  it('stats show a dash when nothing is declared', () => {
    const vm: StatsVM = { stats: { declared: 0, total: 243, closest: null, biggest: null, flipped: null }, closest10: [], biggest10: [], flipped: [], ticker: [], isLive: true, partyColor: new Map(), onFocus: noop, onSelectSeat: noop };
    render(<StatsStrip vm={vm} variant="tile" />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});
