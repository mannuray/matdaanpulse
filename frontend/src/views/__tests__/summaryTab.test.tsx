// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '../../i18n';
import { SummaryTab, formatSummaryValue } from '../dashboard/SummaryTab';
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
    { id: 'seat:1', label: 'Sandesh', sub: 'JDU', value: 27, valueFormat: 'signed', seatIds: ['S1'] },
    { id: 'party:BJP', label: 'BJP', value: 89, valueFormat: 'int', color: '#f70', partyIds: ['BJP'], bar: { value: 40, max: 100, color: '#f70' } },
    { id: 'p3', label: 'Third', value: 12.34, valueFormat: 'pct' },
  ] },
  { id: 'b', titleKey: 'studio_sum_net_swing', rows: [{ id: 'q', label: 'Q', value: 1, valueFormat: 'int' }, { id: 'q2', label: 'Q2', value: 2, valueFormat: 'int' }] },
  { id: 'c', titleKey: 'studio_sum_margin_trend', rows: [], chart: { type: 'line', series: [] } },
];
const mk = (over: Partial<SummaryVM> = {}, secs = sections): SummaryVM => ({
  layer: 'swing', summary: { layer: 'swing', sections: secs }, lockedRowId: null,
  onFocus: noop, onHoverRow: noop, onLockRow: noop, onSelectSeat: noop, ...over,
});

describe('formatSummaryValue', () => {
  it('formats per valueFormat', () => {
    expect(formatSummaryValue(12345, 'int')).toBe((12345).toLocaleString());
    expect(formatSummaryValue(12.34, 'pct')).toBe('12.3%');
    expect(formatSummaryValue(5, 'signed')).toBe('+5');
    expect(formatSummaryValue(-5, 'signed')).toBe('−5');
    expect(formatSummaryValue(null, 'int')).toBe('—');
  });
});

describe('SummaryTab', () => {
  it('shows titles, rows and a footer for what does not fit', () => {
    // 22 + 3*32 = 118 for A; footer 24 reserved => 400 fits A then B(4+22+64=90)= 208... use 190: A=118, B needs 4+22+32=58 -> 176+24=200 > 190
    height(190);
    render(<SummaryTab vm={mk()} />);
    expect(screen.getByText('Closest contests')).toBeTruthy();
    expect(screen.getByText('Sandesh')).toBeTruthy();
    expect(screen.getByText('+27')).toBeTruthy();
    expect(screen.getByText('12.3%')).toBeTruthy();
    expect(screen.queryByText('Net swing')).toBeNull();
    expect(screen.getByText('+2 more rows · 2 more sections')).toBeTruthy();
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

  it('shows everything without a footer when it fits (chart-only sections excluded)', () => {
    height(600);
    render(<SummaryTab vm={mk({}, sections.slice(0, 2))} />);
    expect(screen.getByText('Net swing')).toBeTruthy();
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it('renders the empty state', () => {
    height(300);
    render(<SummaryTab vm={mk({}, [])} />);
    expect(screen.getByText('No data for this layer')).toBeTruthy();
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
});
