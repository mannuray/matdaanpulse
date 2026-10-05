// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '../../i18n';
import { SummaryTab, SummaryPreview } from '../dashboard/SummaryTab';
import { StandingsTile } from '../dashboard/StandingsTile';
import type { SummaryVM, SummarySection } from '../../viewmodels/tiles/useSummaryVM';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';

const noop = () => {};
const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, unknown>).matchMedia;
  if (original) Object.defineProperty(HTMLElement.prototype, 'clientHeight', original);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});
const height = (h: number) => Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => h });

const sections: SummarySection[] = [
  { id: 'a', titleKey: 'studio_sum_closest', rows: [
    { id: 'seat:1', label: 'Sandesh', sub: 'JDU', value: 27, valueFormat: 'compact', seatIds: ['S1'] },
    { id: 'party:BJP', label: 'BJP', value: 89, valueFormat: 'int', color: '#f70', partyIds: ['BJP'], seatIds: ['S1', 'S2'], bar: { value: 40, max: 100, color: '#f70' } },
    { id: 'p3', label: 'Third', value: 73572, valueFormat: 'compact' },
  ] },
  { id: 'b', titleKey: 'studio_sum_net_swing', rows: [{ id: 'q', label: 'Q', value: 1, valueFormat: 'int' }, { id: 'q2', label: 'Q2', value: 2, valueFormat: 'int' }] },
  { id: 'c', titleKey: 'studio_sum_margin_trend', rows: [], chart: { type: 'line', series: [] } },
];
const mk = (over: Partial<SummaryVM> = {}, secs = sections): SummaryVM => ({
  electionId: 'E1', layer: 'swing', layers: ['overview', 'swing'], summary: { layer: 'swing', sections: secs }, lockedRowId: null,
  onFocus: noop, onLayer: noop, onHoverRow: noop, onLockRow: noop, onSelectSeat: noop, regions: null, lockedRegion: null, onHoverRegion: noop, onLockRegion: noop, ...over,
});

/** Cases that read every section open the collapsed headers first. */
const expandAll = () => screen.queryAllByRole('button', { expanded: false }).forEach(b => fireEvent.click(b));

describe('SummaryTab', () => {
  it('shows every section with every row once expanded, sticky headers, and no "+N more" footer', () => {
    const { container } = render(<SummaryTab vm={mk()} />);
    expandAll();
    expect(screen.getByText('Closest contests')).toBeTruthy();
    expect(screen.getByText('Sandesh')).toBeTruthy();
    expect(screen.getByText('27')).toBeTruthy();
    expect(screen.getByText('73.6K')).toBeTruthy();
    expect(screen.getByText('Net swing by alliance')).toBeTruthy();
    expect(screen.getByText('Q2')).toBeTruthy();
    // the chart-only section (no rows) is skipped
    expect(screen.queryByText('Margin trend')).toBeNull();
    expect(screen.queryByText(/more/)).toBeNull();
    const headers = container.querySelectorAll('h3');
    expect(headers).toHaveLength(2);
    headers.forEach(h => { expect(h.className).toContain('sticky'); expect(h.className).toContain('top-0'); expect(h.className).toContain('bg-tile'); expect(h.className).toContain('border-b'); });
  });

  it('a single-seat row selects the seat; other rows lock and hover', () => {
    const onFocus = vi.fn(); const onSelectSeat = vi.fn(); const onLockRow = vi.fn(); const onHoverRow = vi.fn();
    render(<SummaryTab vm={mk({ onFocus, onSelectSeat, onLockRow, onHoverRow })} />);
    fireEvent.click(screen.getByRole('button', { name: /Sandesh/ }));
    expect(onSelectSeat).toHaveBeenCalledWith('S1');
    expect(onLockRow).not.toHaveBeenCalled();
    const bjp = screen.getByRole('button', { name: /BJP/ });
    fireEvent.mouseEnter(bjp);
    expect(onHoverRow).toHaveBeenLastCalledWith(sections[0].rows[1]);
    fireEvent.click(bjp);
    expect(onLockRow).toHaveBeenCalledWith(sections[0].rows[1]);
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
      { id: 'reserved', titleKey: 'studio_sum_reserved', primaryCol: 2, rows: [{ id: 'party:JDU', label: 'JDU', partyIds: ['JDU'], seatIds: ['S1', 'S2'], value: 14, valueFormat: 'intDash', extra: [{ value: 0, format: 'intDash' }, { value: 14, format: 'int' }] }] },
      { id: 'wasted', titleKey: 'studio_sum_wasted', primaryCol: 2, rows: [{ id: 'alliance:MGB', label: 'MGB', partyIds: ['RJD'], seatIds: ['S1', 'S2'], value: 18020000, valueFormat: 'lakh', extra: [{ value: 14770000, format: 'lakh' }, { value: 82, format: 'pct' }] }] },
      { id: 'vs', titleKey: 'studio_sum_vote_vs_seats_alliances', primaryCol: 0, rows: [{ id: 'alliance:NDA', label: 'NDA', partyIds: ['BJP'], seatIds: ['S1', 'S2'], value: 35, valueFormat: 'signed1', extra: [{ value: 48.1, format: 'pct' }] }] },
    ];
    render(<SummaryTab vm={mk({}, secs)} />);
    expandAll();
    expect(screen.getByRole('button', { name: /JDU/ }).textContent).toContain('14');
    expect(screen.getByRole('button', { name: /MGB/ }).textContent).toContain('82.0%');
    expect(screen.getByRole('button', { name: /NDA/ }).textContent).toContain('+35.0');
  });

  it('a section with a chart shows its plain rows in the compact tab (R36)', () => {
    height(400);
    const withChart: SummarySection = { id: 'md', titleKey: 'studio_sum_margin_dist', columnsKeys: ['studio_col_total', 'NDA'], rows: [
      { id: 'bucket:0', label: '< 1K', seatIds: ['A', 'E'], value: 2, valueFormat: 'int', extra: [{ value: 1, format: 'int' }] },
    ], chart: { type: 'groupedBar', series: [] } };
    render(<SummaryTab vm={mk({}, [withChart])} />);
    expect(screen.getByText('Margin distribution')).toBeTruthy();
    expect(screen.getByRole('button', { name: /< 1K/ }).textContent).toContain('2');
  });

  it('clears a row-set hover highlight when it unmounts', () => {
    height(300);
    const onHoverRow = vi.fn();
    const { unmount } = render(<SummaryTab vm={mk({ onHoverRow })} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /BJP/ }));
    onHoverRow.mockClear();
    unmount();
    expect(onHoverRow).toHaveBeenCalledWith(null);
  });

  it('never wipes a hover it did not set (another tile\'s hover survives live updates and unmounts)', () => {
    height(300);
    const onHoverRow = vi.fn();
    const vm = mk({ onHoverRow });
    const { rerender, unmount } = render(<SummaryTab vm={vm} />);
    rerender(<SummaryTab vm={{ ...vm, summary: { layer: 'swing', sections: [sections[1]] } }} />);
    unmount();
    expect(onHoverRow).not.toHaveBeenCalled();
  });

  it('after the mouse left a row there is nothing left to clear', () => {
    height(300);
    const onHoverRow = vi.fn();
    const { unmount } = render(<SummaryTab vm={mk({ onHoverRow })} />);
    const bjp = screen.getByRole('button', { name: /BJP/ });
    fireEvent.mouseEnter(bjp); fireEvent.mouseLeave(bjp);
    onHoverRow.mockClear();
    unmount();
    expect(onHoverRow).not.toHaveBeenCalled();
  });

  it('rows without a highlight target are plain text: no button, no aria-pressed', () => {
    height(300);
    const stats: SummarySection = { id: 'key_stats', titleKey: '', layout: 'stats', rows: [{ id: 'declared', label: 'declared', labelKey: 'seats_declared', value: 243, valueFormat: 'int' }] };
    const plain: SummarySection = { id: 'wasted', titleKey: 'studio_sum_wasted', rows: [{ id: 'efficiency_gap', label: 'Others', value: 3, valueFormat: 'int' }, { id: 'party:BJP', label: 'BJP', value: 4, valueFormat: 'int', partyIds: ['BJP'], seatIds: ['S1', 'S2'] }] };
    const { container } = render(<SummaryTab vm={mk({}, [stats, plain])} />);
    expect(screen.queryByRole('button', { name: /Others/ })).toBeNull();
    expect(screen.getByText('Others').closest('div[class*="h-7"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Declared/i })).toBeNull();
    expect(container.querySelectorAll('button[aria-pressed]')).toHaveLength(1);
  });

  it('a negative bar is muted (not drawn like a positive one) and the number keeps its sign', () => {
    height(300);
    const neg: SummarySection = { id: 'n', titleKey: 'studio_sum_net_swing', rows: [
      { id: 'a', label: 'AAA', partyIds: ['A'], seatIds: ['S1', 'S2'], value: -12, valueFormat: 'signed', bar: { value: -12, max: 24, color: '#ff0000' } },
      { id: 'b', label: 'BBB', partyIds: ['B'], seatIds: ['S1', 'S2'], value: 12, valueFormat: 'signed', bar: { value: 12, max: 24, color: '#00ff00' } },
    ] };
    render(<SummaryTab vm={mk({}, [neg])} />);
    const fill = (name: RegExp) => screen.getByRole('button', { name }).querySelector('span.h-1\\.5 > span') as HTMLElement;
    expect(fill(/AAA/).style.background).toContain('var(--color-muted)');
    expect(fill(/BBB/).style.background).not.toContain('var(--color-muted)');
    expect(screen.getByRole('button', { name: /AAA/ }).textContent).toContain('−12');
  });

  it('clears the hover highlight when its sections change, not only on unmount', () => {
    height(300);
    const onHoverRow = vi.fn();
    const vm = mk({ onHoverRow });
    const { rerender } = render(<SummaryTab vm={vm} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /BJP/ }));
    onHoverRow.mockClear();
    const next = { ...vm, layer: 'battle' as const, summary: { layer: 'battle' as const, sections: [sections[1]] } };
    rerender(<SummaryTab vm={next} />);
    expect(onHoverRow).toHaveBeenCalledWith(null);
    onHoverRow.mockClear();
    rerender(<SummaryTab vm={{ ...next }} />);
    expect(onHoverRow).not.toHaveBeenCalled();
  });
});

const mockWide = (matches: boolean) => {
  window.matchMedia = ((q: string) => ({ matches, media: q, addEventListener: noop, removeEventListener: noop })) as unknown as typeof window.matchMedia;
};

describe('SummaryPreview (rail)', () => {
  const stats: SummarySection = { id: 'key_stats', titleKey: '', layout: 'stats', rows: [
    { id: 'declared', label: 'declared', labelKey: 'seats_declared', value: 243, valueFormat: 'int' },
    { id: 'avg_margin', label: 'avg_margin', labelKey: 'avg_margin', value: 21100, valueFormat: 'compact' },
  ] };
  it('shows the key stats and no orphan section header when no row fits under it, with no controls', () => {
    const { container } = render(<SummaryPreview vm={mk({}, [stats, sections[0], sections[1]])} />);
    expect(screen.getByText('243')).toBeTruthy();
    expect(screen.getByText('21.1K')).toBeTruthy();
    expect(screen.queryByText('Closest contests')).toBeNull();
    expect(container.querySelectorAll('h3')).toHaveLength(0);
    expect(screen.queryByText('Net swing by alliance')).toBeNull();
    expect(screen.queryByText('Sandesh')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
  it('without key stats it previews the first rows of the first section', () => {
    render(<SummaryPreview vm={mk({}, [sections[0]])} />);
    expect(screen.getByText('Closest contests')).toBeTruthy();
    expect(screen.getByText('Sandesh')).toBeTruthy();
    expect(screen.queryByText('Third')).toBeNull();
  });
  it('never shows the locked highlight on a plain row', () => {
    const { container } = render(<SummaryPreview vm={mk({ lockedRowId: 'a:seat:1' }, [sections[0]])} />);
    expect(container.querySelector('.ring-accent')).toBeNull();
  });
  it('shows the empty state without sections', () => {
    render(<SummaryPreview vm={mk({}, [])} />);
    expect(screen.getByText('No data for this layer')).toBeTruthy();
  });
});

describe('StandingsTile summary tab', () => {
  const st: StandingsVM = { rows: [{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 89, votePct: null, allianceId: 'NDA' }], allRows: [], pulse: false, lockedId: null, onFocus: noop, onHoverParty: noop, onLockParty: noop, markOf: () => null, onOpenParty: noop };
  it('defaults to Summary with the layer in its label, and Parties is one click away', () => {
    height(300);
    mockWide(true);
    render(<StandingsTile vm={st} variant="tile" summary={mk()} />);
    const tabs = screen.getAllByRole('radio').map(r => r.textContent);
    expect(tabs).toEqual(['Summary · Swing', 'Parties']);
    expect(screen.getByText('Closest contests')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Parties' }));
    expect(screen.getByRole('button', { name: /BJP/ })).toBeTruthy();
  });

  it('below xl the Summary tab drops the layer suffix and the tabs stack under the title', () => {
    height(300);
    mockWide(false);
    const { container } = render(<StandingsTile vm={st} variant="tile" summary={mk()} />);
    expect(screen.getAllByRole('radio').map(r => r.textContent)).toEqual(['Summary', 'Parties']);
    const tabs = screen.getByRole('radiogroup').parentElement!;
    expect(tabs.className).toContain('basis-full');
    expect(container.querySelector('header')!.className).toContain('flex-wrap');
  });

  it('the card title follows the tab and the expand button opens that tab\'s focus', () => {
    height(300);
    const onFocus = vi.fn(); const onSummaryFocus = vi.fn();
    const watchlist = { leaders: [], watchlist: [], partyColor: new Map(), seatOptions: [], onFocus: noop, onSelectSeat: noop, onHoverSeat: noop, onAddCustom: noop, onRemoveCustom: noop, markOf: () => null, onOpenParty: noop };
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

describe('SummaryTab collapsible sections', () => {
  const head = (name: RegExp) => screen.getByRole('button', { name });
  const withStats: SummarySection[] = [
    { id: 'key_stats', titleKey: '', layout: 'stats', rows: [{ id: 'declared', label: 'declared', labelKey: 'seats_declared', value: 243, valueFormat: 'int' }] },
    ...sections,
  ];

  it('key stats always show; only the first section is open, the others collapsed with their row count', () => {
    render(<SummaryTab vm={mk({}, withStats)} />);
    expect(screen.getByText('243')).toBeTruthy();
    expect(head(/^Closest contests/).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Sandesh')).toBeTruthy();
    const swing = head(/^Net swing/);
    expect(swing.getAttribute('aria-expanded')).toBe('false');
    expect(swing.textContent).toContain('2');
    expect(screen.queryByText('Q2')).toBeNull();
  });

  it('a heading click toggles its section; several can be open', () => {
    render(<SummaryTab vm={mk()} />);
    fireEvent.click(head(/^Net swing/));
    expect(screen.getByText('Q2')).toBeTruthy();
    expect(screen.getByText('Sandesh')).toBeTruthy();
    fireEvent.click(head(/^Closest contests/));
    expect(screen.queryByText('Sandesh')).toBeNull();
  });

  it('opens the first section when the data arrives after the first render', () => {
    const { rerender } = render(<SummaryTab vm={mk({}, [])} />);
    rerender(<SummaryTab vm={mk()} />);
    expect(head(/^Closest contests/).getAttribute('aria-expanded')).toBe('true');
  });

  it('a new layer starts again with only its first section open', () => {
    const { rerender } = render(<SummaryTab vm={mk()} />);
    fireEvent.click(head(/^Net swing/));
    const next: SummarySection[] = [sections[1], sections[0]];
    rerender(<SummaryTab vm={mk({ layer: 'overview', summary: { layer: 'overview', sections: next } }, next)} />);
    expect(head(/^Net swing/).getAttribute('aria-expanded')).toBe('true');
    expect(head(/^Closest contests/).getAttribute('aria-expanded')).toBe('false');
  });
});
