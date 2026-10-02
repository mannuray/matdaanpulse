// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { StandingsPreview } from '../dashboard/StandingsTile';
import { ScoreboardTile } from '../dashboard/ScoreboardTile';
import { SummaryPreview } from '../dashboard/SummaryTab';
import { DashboardGrid, type DashboardViewProps } from '../dashboard/DashboardGrid';
import type { StandingsVM, StandingRow } from '../../viewmodels/tiles/useStandingsVM';
import type { ScoreboardVM } from '../../viewmodels/tiles/useScoreboardVM';
import type { SummaryVM, SummarySection } from '../../viewmodels/tiles/useSummaryVM';
import type { FocusTile } from '../../viewmodels/store/dashboardStore';

vi.mock('../map/MapTile', () => ({ MapTile: () => <div data-testid="map" /> }));
vi.mock('../dashboard/StatsStrip', () => ({ StatsStrip: () => null }));
vi.mock('../dashboard/LeadersStrip', () => ({ LeadersStrip: () => null }));
vi.mock('../dashboard/LayerInsightStrip', () => ({ LayerInsightStrip: () => null }));
vi.mock('../seat/SeatDialog', () => ({ SeatDialog: () => null }));

afterEach(cleanup);
const noop = () => {};

const row = (id: string, seats: number): StandingRow => ({ id, name: `${id} party`, color: '#f70', seats, votePct: null, allianceId: null });
const standings = (rows: StandingRow[]): StandingsVM => ({ rows, allRows: rows, pulse: false, lockedId: null, onFocus: noop, onHoverParty: noop, onLockParty: noop, markOf: () => null, onOpenParty: noop });

describe('StandingsPreview', () => {
  it('shows the top four parties (dot, short id, bar, seats) and +N more, with no buttons', () => {
    const rows = [row('BJP', 89), row('JDU', 40), row('RJD', 30), row('INC', 10), row('CPI', 6), row('AIMIM', 5)];
    const { container } = render(<StandingsPreview vm={standings(rows)} />);
    expect(container.querySelectorAll('[data-preview-row]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-preview-bar]')).toHaveLength(4);
    expect(screen.getByText('BJP')).toBeTruthy();
    expect(screen.getByText('89')).toBeTruthy();
    expect(screen.queryByText('CPI')).toBeNull();
    expect(screen.getByText('+2 more parties · 11 seats')).toBeTruthy();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
  it('has no "+N more" when everything fits, and an empty state without rows', () => {
    const { container, rerender } = render(<StandingsPreview vm={standings([row('BJP', 3)])} />);
    expect(container.textContent).not.toContain('more');
    rerender(<StandingsPreview vm={standings([])} />);
    expect(screen.getByText('No results yet')).toBeTruthy();
  });
});

describe('ScoreboardTile compact', () => {
  const board: ScoreboardVM = {
    blocs: [{ id: 'NDA', name: 'National Democratic Alliance', color: '#FF7A1A', seats: 202, votePct: 48.1, kind: 'alliance', label: 'NDA', textColor: '#FF7A1A' }, { id: 'MGB', name: 'Mahagathbandhan', color: '#7BD34A', seats: 34, votePct: 37.1, kind: 'alliance', label: 'MGB', textColor: '#7BD34A' }],
    others: { seats: 7, votePct: 14.8 }, totalSeats: 243, majority: 122, countedSeats: 243, winnerId: 'NDA', marginOverMajority: 80,
    status: 'final', pulse: false, breakdown: [], lockedId: null, onFocus: noop, onHoverBloc: noop, onLockBloc: noop,
  };
  it('uses the short bloc label, keeping the full name in title and aria-label', () => {
    render(<ScoreboardTile vm={board} variant="compact" />);
    const nda = screen.getByRole('button', { name: /National Democratic Alliance 202/ });
    expect(nda.getAttribute('title')).toBe('National Democratic Alliance');
    expect(within(nda).getByText('NDA')).toBeTruthy();
    expect(screen.getByText('MGB')).toBeTruthy();
    expect(screen.queryByText('Mahagathbandhan')).toBeNull();
  });
  it('is a compact tile: short header, no full-size seat numbers', () => {
    const { container } = render(<ScoreboardTile vm={board} variant="compact" />);
    expect(container.querySelector('[data-bloc-row]')).toBeTruthy();
    expect(container.innerHTML).not.toContain('text-5xl');
  });
  it('the focus variant still spells the names out', () => {
    render(<ScoreboardTile vm={board} variant="focus" />);
    expect(screen.getAllByText('National Democratic Alliance').length).toBeGreaterThan(0);
  });
});

describe('SummaryPreview is never interactive', () => {
  const stats: SummarySection = { id: 'key_stats', titleKey: '', layout: 'stats', rows: [
    { id: 'a', label: 'a', labelKey: 'seats_declared', value: 243, valueFormat: 'int', seatIds: ['S1', 'S2'] },
    { id: 'b', label: 'b', labelKey: 'avg_margin', value: 21100, valueFormat: 'compact', partyIds: ['BJP'] },
  ] };
  const list: SummarySection = { id: 'l', titleKey: 'studio_sum_closest', rows: [{ id: 'r', label: 'Sandesh', value: 27, valueFormat: 'compact', seatIds: ['S1'] }] };
  const vm = (secs: SummarySection[]): SummaryVM => ({ electionId: 'E1', layer: 'swing', layers: ['swing'], summary: { layer: 'swing', sections: secs }, lockedRowId: null, onFocus: noop, onLayer: noop, onHoverRow: noop, onLockRow: noop, onSelectSeat: noop });
  it('renders key stats with seat/party ids as plain text', () => {
    const { container } = render(<SummaryPreview vm={vm([stats, list])} />);
    expect(screen.getByText('243')).toBeTruthy();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
  it('renders first-section rows with seat ids as plain text', () => {
    const { container } = render(<SummaryPreview vm={vm([list])} />);
    expect(screen.getByText('Sandesh')).toBeTruthy();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('mobile rail titles', () => {
  const props = (focus: FocusTile | null, onFocus = noop) => ({
    topBar: { electionType: 'VS', electionId: 'e', states: [], stateId: null, years: [], lsElections: [], electionLabel: 'VS · X 2025', statusLabel: { kind: 'final', declared: 1, total: 1 }, shareText: '', lang: 'en', langs: ['en'], onType: noop, onState: noop, onElection: noop, onLang: noop, onSearchSeat: noop, theme: 'dark', onTheme: noop, onToggleTheme: noop },
    search: { query: '', open: false, seats: [], candidates: [], onQuery: noop, onOpen: noop, onPick: noop },
    scoreboard: { blocs: [], others: { seats: 0, votePct: null }, totalSeats: 1, majority: 1, countedSeats: 0, winnerId: null, marginOverMajority: null, status: 'final', pulse: false, breakdown: [], lockedId: null, onFocus: noop, onHoverBloc: noop, onLockBloc: noop },
    standings: { ...standings([row('BJP', 5)]), onFocus },
    insight: { onFocus: noop }, leaders: { watchlist: [], leaders: [], partyColor: new Map(), seatOptions: [], onFocus: noop }, stats: { onFocus: noop },
    map: {}, seatDialog: null, focus, onCloseFocus: noop,
  }) as unknown as DashboardViewProps;
  const grid = (p: DashboardViewProps) => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardGrid {...p} /></MemoryRouter>;

  it('the Party standings card keeps its title even when the watchlist opened the standings focus', () => {
    const onFocus = vi.fn();
    const { rerender } = render(grid(props(null, onFocus)));
    expect(screen.getByRole('group', { name: 'Party Standings' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /open watchlist/i }));
    expect(onFocus).toHaveBeenCalled();
    rerender(grid(props('standings', onFocus)));
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Watchlist' })).toBeTruthy();
    expect(screen.getAllByRole('group', { name: 'Party Standings', hidden: true })).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Watchlist' })).toBeNull();
  });
});
