// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import '../../i18n';
import { StandingsTile, WatchlistPreview } from '../dashboard/StandingsTile';
import { LeadersStrip } from '../dashboard/LeadersStrip';
import { fitCount } from '../../viewmodels/tiles/fit';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';
import type { LeadersVM, LeaderCard } from '../../viewmodels/tiles/useLeadersVM';

const noop = () => {};
const origW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const origH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
afterEach(() => {
  cleanup();
  for (const [k, d] of [['clientWidth', origW], ['clientHeight', origH]] as const) {
    if (d) Object.defineProperty(HTMLElement.prototype, k, d); else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
  }
});

const card = (i: number, over: Partial<LeaderCard> = {}): LeaderCard => ({
  key: `k${i}`, name: `Leader ${i}`, constId: `C${i}`, constName: `Seat ${i}`, partyId: 'BJP', status: 'LEADING', margin: 100 + i, custom: false, ...over,
});
const leadersVM = (over: Partial<LeadersVM> = {}): LeadersVM => ({
  leaders: [], watchlist: [], partyColor: new Map(), seatOptions: [{ id: 'C9', name: 'Nine' }],
  onFocus: noop, onSelectSeat: noop, onHoverSeat: noop, onAddCustom: noop, onRemoveCustom: noop, ...over,
});
const standingsVM: StandingsVM = { rows: [{ id: 'BJP', name: 'Party', color: '#fff', seats: 3, votePct: null, allianceId: null }], allRows: [], pulse: false, lockedId: null, onFocus: noop, onHoverParty: noop, onLockParty: noop };

describe('LeadersStrip fits by width', () => {
  it('renders only the cards that fit and a "+N more" chip that opens the focus view', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 });
    const onFocus = vi.fn();
    const { count } = fitCount({ available: 1000, itemHeight: 240, gap: 8, footerHeight: 96, total: 6 });
    expect(count).toBe(3);
    render(<LeadersStrip vm={leadersVM({ leaders: [0, 1, 2, 3, 4, 5].map(i => card(i)), onFocus })} variant="tile" />);
    expect(screen.getAllByRole('button', { name: /Leader \d/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '+3 more' }));
    expect(onFocus).toHaveBeenCalled();
  });

  it('shows every leader and no chip when they all fit', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1600 });
    render(<LeadersStrip vm={leadersVM({ leaders: [0, 1, 2].map(i => card(i)) })} variant="tile" />);
    expect(screen.getAllByRole('button', { name: /Leader \d/ })).toHaveLength(3);
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it('focus variant lists all manifest leaders without add/remove UI', () => {
    render(<LeadersStrip vm={leadersVM({ leaders: [0, 1, 2, 3, 4].map(i => card(i)) })} variant="focus" />);
    expect(screen.getAllByRole('button', { name: /Leader \d/ })).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Add/ })).toBeNull();
  });
});

describe('StandingsTile watchlist tab', () => {
  it('defaults to Parties, switches to Watchlist rows, and the x removes a seat', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 });
    const onRemoveCustom = vi.fn();
    const onSelectSeat = vi.fn();
    const lvm = leadersVM({ watchlist: [card(1, { custom: true })], onRemoveCustom, onSelectSeat });
    render(<StandingsTile vm={standingsVM} variant="tile" watchlist={lvm} />);
    expect(screen.getByRole('button', { name: /^BJP Party/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Watchlist (1)' }));
    expect(screen.queryByRole('button', { name: /^BJP Party/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Seat 1/ }));
    expect(onSelectSeat).toHaveBeenCalledWith('C1');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Seat 1' }));
    expect(onRemoveCustom).toHaveBeenCalledWith('C1');
    expect(screen.getByRole('combobox', { name: /Add a seat/ })).toBeTruthy();
  });

  it('shows the empty state on an empty watchlist', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 });
    render(<StandingsTile vm={standingsVM} variant="tile" watchlist={leadersVM()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Watchlist (0)' }));
    expect(screen.getByText('Track seats from the map to follow them here')).toBeTruthy();
  });

  it('focus variant honours initialTab', () => {
    render(<StandingsTile vm={standingsVM} variant="focus" watchlist={leadersVM({ watchlist: [card(2, { custom: true })] })} initialTab="watchlist" />);
    expect(screen.getByRole('button', { name: /^Seat 2/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Seat 2' })).toBeTruthy();
  });
});

describe('StandingsTile watchlist expand', () => {
  const calls: string[] = [];
  const setup = (extra: Partial<LeadersVM> = {}, height = 300) => {
    calls.length = 0;
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => height });
    const vm = { ...standingsVM, onFocus: () => calls.push('focus') };
    const lvm = leadersVM({ watchlist: [card(1, { custom: true })], ...extra });
    render(<StandingsTile vm={vm} variant="tile" watchlist={lvm} onTabChange={t => calls.push(`tab:${t}`)} />);
  };

  it('the expand button on the Watchlist tab reports "watchlist" before opening the focus', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: /Watchlist/ }));
    calls.length = 0;
    fireEvent.click(screen.getByRole('button', { name: /expand watchlist/i }));
    expect(calls).toEqual(['tab:watchlist', 'focus']);
  });

  it('every watched seat is listed in the scroll area, with no "+N more" link; the add picker sits outside it', () => {
    setup({ watchlist: [1, 2, 3, 4, 5, 6, 7, 8].map(i => card(i)) }, 120);
    fireEvent.click(screen.getByRole('radio', { name: /Watchlist/ }));
    const region = screen.getByRole('region', { name: /Watchlist/ });
    expect(within(region).getAllByRole('button', { name: /^Seat \d/ })).toHaveLength(8);
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull();
    expect(region.contains(screen.getByRole('combobox', { name: /Add a seat/ }))).toBe(false);
  });

  it('the Parties tab expands as "parties" (a stale watchlist choice does not stick)', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: /Watchlist/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Parties' }));
    calls.length = 0;
    fireEvent.click(screen.getByRole('button', { name: /expand party standings/i }));
    expect(calls).toEqual(['tab:parties', 'focus']);
  });
});

describe('WatchlistPreview (rail)', () => {
  it('renders plain rows: no buttons, no remove control', () => {
    const { container } = render(<WatchlistPreview vm={leadersVM({ watchlist: [card(1), card(2), card(3)] })} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(screen.queryByText('✕')).toBeNull();
    expect(screen.getByText('Seat 1')).toBeTruthy();
    expect(screen.getByText('Seat 2')).toBeTruthy();
    expect(screen.queryByText('Seat 3')).toBeNull();
  });
});
