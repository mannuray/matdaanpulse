// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '../../i18n';
import { SummaryTab } from '../dashboard/SummaryTab';
import { StandingsTile } from '../dashboard/StandingsTile';
import type { SummaryVM, SummarySection } from '../../viewmodels/tiles/useSummaryVM';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';

const noop = () => {};
const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(HTMLElement.prototype, 'clientHeight', original);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});
const height = (h: number) => Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => h });

const sections: SummarySection[] = [
  { id: 'a', titleKey: 'studio_sum_closest', rows: [
    { id: 'seat:1', label: 'Sandesh', sub: 'JDU', value: 27, valueFormat: 'compact', seatIds: ['S1'] },
    { id: 'party:BJP', label: 'BJP', value: 89, valueFormat: 'int', color: '#f70', partyIds: ['BJP'], bar: { value: 40, max: 100, color: '#f70' } },
    { id: 'p3', label: 'Third', value: 73572, valueFormat: 'compact' },
  ] },
  { id: 'b', titleKey: 'studio_sum_net_swing', rows: [{ id: 'q', label: 'Q', value: 1, valueFormat: 'int' }, { id: 'q2', label: 'Q2', value: 2, valueFormat: 'int' }] },
  { id: 'c', titleKey: 'studio_sum_margin_trend', rows: [], chart: { type: 'line', series: [] } },
];
const mk = (over: Partial<SummaryVM> = {}, secs = sections): SummaryVM => ({
  layer: 'swing', layers: ['overview', 'swing'], summary: { layer: 'swing', sections: secs }, lockedRowId: null,
  onFocus: noop, onLayer: noop, onHoverRow: noop, onLockRow: noop, onSelectSeat: noop, ...over,
});

describe('SummaryTab', () => {
  it('shows titles, rows and a footer for what does not fit', () => {
    // A = 22 + 3*32 = 118; B needs 4 + 22 + 32 = 58 -> 176 + footer 24 = 200 > 190.
    height(190);
    render(<SummaryTab vm={mk()} />);
    expect(screen.getByText('Closest contests')).toBeTruthy();
    expect(screen.getByText('Sandesh')).toBeTruthy();
    expect(screen.getByText('27')).toBeTruthy();
    expect(screen.getByText('73.6K')).toBeTruthy();
    expect(screen.queryByText('Net swing by alliance')).toBeNull();
    expect(screen.getByText('+2 more rows · 2 more sections')).toBeTruthy();
  });

  it('uses singular forms in the footer', () => {
    height(170);
    const secs: SummarySection[] = [sections[0], { id: 'b', titleKey: 'studio_sum_net_swing', rows: [{ id: 'q', label: 'Q', value: 1, valueFormat: 'int' }] }];
    render(<SummaryTab vm={mk({}, secs)} />);
    expect(screen.getByText('+1 more row · 1 more section')).toBeTruthy();
  });

  it('footer opens the focus; a single-seat row selects the seat; other rows lock and hover', () => {
    height(190);
    const onFocus = vi.fn(); const onSelectSeat = vi.fn(); const onLockRow = vi.fn(); const onHoverRow = vi.fn();
    render(<SummaryTab vm={mk({ onFocus, onSelectSeat, onLockRow, onHoverRow })} />);
    fireEvent.click(screen.getByRole('button', { name: /more/ }));
    expect(onFocus).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sandesh/ }));
    expect(onSelectSeat).toHaveBeenCalledWith('S1');
    expect(onLockRow).not.toHaveBeenCalled();
    const bjp = screen.getByRole('button', { name: /BJP/ });
    fireEvent.mouseEnter(bjp);
    expect(onHoverRow).toHaveBeenLastCalledWith(sections[0].rows[1]);
    fireEvent.click(bjp);
    expect(onLockRow).toHaveBeenCalledWith(sections[0].rows[1]);
  });

  it('shows everything without a footer when it fits ', () => {
    height(600);
    render(<SummaryTab vm={mk({}, sections.slice(0, 2))} />);
    expect(screen.getByText('Net swing by alliance')).toBeTruthy();
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it('renders the empty state', () => {
    height(300);
    render(<SummaryTab vm={mk({}, [])} />);
    expect(screen.getByText('No data for this layer')).toBeTruthy();
  });

  it('a stats section shows its numbers side by side, untitled when titleKey is empty', () => {
    height(300);
    const stats: SummarySection = { id: 'key_stats', titleKey: '', layout: 'stats', rows: [
      { id: 'declared', label: 'declared', labelKey: 'seats_declared', value: 243, valueFormat: 'int' },
      { id: 'avg_margin', label: 'avg_margin', labelKey: 'avg_margin', value: 21100, valueFormat: 'compact' },
      { id: 'median', label: 'median', labelKey: 'median_margin', value: 18800, valueFormat: 'compact' },
    ] };
    render(<SummaryTab vm={mk({}, [stats, sections[1]])} />);
    expect(screen.getByText('243')).toBeTruthy();
    expect(screen.getByText('21.1K')).toBeTruthy();
    expect(screen.getByText('18.8K')).toBeTruthy();
    expect(screen.getByText('Avg Margin')).toBeTruthy();
    expect(screen.getByText('Median')).toBeTruthy();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('shows the section\'s primary column: "–" for zero reserved seats, lakh totals, signed decimals', () => {
    height(400);
    const secs: SummarySection[] = [
      { id: 'reserved', titleKey: 'studio_sum_reserved', primaryCol: 2, rows: [{ id: 'party:JDU', label: 'JDU', value: 14, valueFormat: 'intDash', extra: [{ value: 0, format: 'intDash' }, { value: 14, format: 'int' }] }] },
      { id: 'wasted', titleKey: 'studio_sum_wasted', primaryCol: 2, rows: [{ id: 'alliance:MGB', label: 'MGB', value: 18020000, valueFormat: 'lakh', extra: [{ value: 14770000, format: 'lakh' }, { value: 82, format: 'pct' }] }] },
      { id: 'vs', titleKey: 'studio_sum_vote_vs_seats_alliances', primaryCol: 0, rows: [{ id: 'alliance:NDA', label: 'NDA', value: 35, valueFormat: 'signed1', extra: [{ value: 48.1, format: 'pct' }] }] },
    ];
    render(<SummaryTab vm={mk({}, secs)} />);
    expect(screen.getByRole('button', { name: /JDU/ }).textContent).toContain('14');
    expect(screen.getByRole('button', { name: /MGB/ }).textContent).toContain('82.0%');
    expect(screen.getByRole('button', { name: /NDA/ }).textContent).toContain('+35.0');
  });

  it('a section with a chart shows its plain rows in the compact tab (R36)', () => {
    height(400);
    const withChart: SummarySection = { id: 'md', titleKey: 'studio_sum_margin_dist', columnsKeys: ['studio_col_total', 'NDA'], rows: [
      { id: 'bucket:0', label: '< 1K', value: 2, valueFormat: 'int', extra: [{ value: 1, format: 'int' }] },
    ], chart: { type: 'groupedBar', series: [] } };
    render(<SummaryTab vm={mk({}, [withChart])} />);
    expect(screen.getByText('Margin distribution')).toBeTruthy();
    expect(screen.getByRole('button', { name: /< 1K/ }).textContent).toContain('2');
  });

  it('clears the hover highlight when it unmounts', () => {
    height(300);
    const onHoverRow = vi.fn();
    const { unmount } = render(<SummaryTab vm={mk({ onHoverRow })} />);
    onHoverRow.mockClear();
    unmount();
    expect(onHoverRow).toHaveBeenCalledWith(null);
  });

  it('clears the hover highlight when its sections change, not only on unmount', () => {
    height(300);
    const onHoverRow = vi.fn();
    const vm = mk({ onHoverRow });
    const { rerender } = render(<SummaryTab vm={vm} />);
    onHoverRow.mockClear();
    const next = { ...vm, layer: 'battle' as const, summary: { layer: 'battle' as const, sections: [sections[1]] } };
    rerender(<SummaryTab vm={next} />);
    expect(onHoverRow).toHaveBeenCalledWith(null);
    onHoverRow.mockClear();
    rerender(<SummaryTab vm={{ ...next }} />);
    expect(onHoverRow).not.toHaveBeenCalled();
  });
});

describe('StandingsTile summary tab', () => {
  const st: StandingsVM = { rows: [{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 89, votePct: null, allianceId: 'NDA' }], allRows: [], pulse: false, lockedId: null, onFocus: noop, onHoverParty: noop, onLockParty: noop };
  it('defaults to Summary with the layer in its label, and Parties is one click away', () => {
    height(300);
    render(<StandingsTile vm={st} variant="tile" summary={mk()} />);
    const tabs = screen.getAllByRole('radio').map(r => r.textContent);
    expect(tabs).toEqual(['Summary · Swing', 'Parties']);
    expect(screen.getByText('Closest contests')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Parties' }));
    expect(screen.getByRole('button', { name: /BJP/ })).toBeTruthy();
  });

  it('the card title follows the tab and the expand button opens that tab\'s focus', () => {
    height(300);
    const onFocus = vi.fn(); const onSummaryFocus = vi.fn();
    const watchlist = { leaders: [], watchlist: [], partyColor: new Map(), seatOptions: [], onFocus: noop, onSelectSeat: noop, onHoverSeat: noop, onAddCustom: noop, onRemoveCustom: noop };
    render(<StandingsTile vm={{ ...st, onFocus }} variant="tile" summary={mk({ onFocus: onSummaryFocus })} watchlist={watchlist} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Election summary');
    fireEvent.click(screen.getByRole('button', { name: /expand election summary/i }));
    expect(onSummaryFocus).toHaveBeenCalled();
    expect(onFocus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Parties' }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Party Standings');
    fireEvent.click(screen.getByRole('button', { name: /expand party standings/i }));
    expect(onFocus).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: /Watchlist/ }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Watchlist');
  });
});
