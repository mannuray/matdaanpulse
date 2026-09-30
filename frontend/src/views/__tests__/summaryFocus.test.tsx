// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import '../../i18n';
import { SummaryFocus } from '../dashboard/SummaryFocus';
import type { SummaryVM, SummarySection } from '../../viewmodels/tiles/useSummaryVM';

afterEach(cleanup);
const noop = () => {};

const sections: SummarySection[] = [
  { id: 'key_stats', titleKey: '', layout: 'stats', rows: [
    { id: 'declared', label: 'declared', labelKey: 'seats_declared', value: 243, valueFormat: 'int' },
    { id: 'avg', label: 'avg', labelKey: 'avg_margin', value: 21100, valueFormat: 'compact' },
    { id: 'med', label: 'med', labelKey: 'median_margin', value: 18800, valueFormat: 'compact' },
  ] },
  { id: 'margin_trend', titleKey: 'studio_sum_margin_trend', columnsKeys: ['studio_col_avg_margin', 'studio_col_median_margin', 'studio_col_seats'],
    rows: [
      { id: 'year:2015', label: '2015', value: 21100, valueFormat: 'compact', seatIds: ['Y1'], extra: [{ value: 18800, format: 'compact' }, { value: 243, format: 'int' }] },
      { id: 'year:2020', label: '2020', value: 15000, valueFormat: 'compact', seatIds: ['Y2'], extra: [{ value: null, format: 'compact' }, { value: 0, format: 'intDash' }] },
    ],
    chart: { type: 'line', series: [{ id: 'avg', label: 'Average', labelKey: 'studio_col_avg_margin', color: '#8B7CFF', points: [{ x: 2015, y: 21100 }, { x: 2020, y: 15000 }] }] } },
  { id: 'closest', titleKey: 'studio_sum_closest', rows: [
    { id: 'seat:1', label: 'Sandesh', sub: 'JDU', value: 27, valueFormat: 'compact', seatIds: ['S1'] },
    { id: 'party:BJP', label: 'BJP', value: 89, valueFormat: 'int', partyIds: ['BJP'], seatIds: ['S1', 'S2'] },
  ] },
  { id: 'party_trend', titleKey: 'studio_sum_party_trend', columnsKeys: ['2015', '2020'], rows: [
    { id: 'party:RJD', label: 'RJD', partyIds: ['RJD'], seatIds: ['S1', 'S2'], value: 80, valueFormat: 'text', valueText: '80/21.1K', extra: [{ value: null, format: 'text', text: '–' }] },
  ] },
];
const mk = (over: Partial<SummaryVM> = {}, secs = sections): SummaryVM => ({
  electionId: 'E1', layer: 'history', layers: ['overview', 'battle', 'swing', 'history'], summary: { layer: 'history', sections: secs }, lockedRowId: null,
  onFocus: noop, onLayer: noop, onHoverRow: noop, onLockRow: noop, onSelectSeat: noop, ...over,
});

describe('SummaryFocus', () => {
  it('shows the header, every section with all rows, the key stats and the chart', () => {
    const { container } = render(<SummaryFocus vm={mk()} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Summary · History');
    ['Margin trend', 'Closest contests', 'Party seats over elections'].forEach(n => expect(screen.getByRole('heading', { name: n })).toBeTruthy());
    const stats = container.querySelector('[data-stats]')!;
    expect(stats.textContent).toContain('243');
    expect(stats.textContent).toContain('21.1K');
    expect(stats.textContent).toContain('Median');
    expect(screen.getByText('Sandesh')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Margin trend' })).toBeTruthy();
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(1);
  });

  it('renders cells in [value, ...extra] order under the column headers with the shared formatter', () => {
    const { container } = render(<SummaryFocus vm={mk()} />);
    const heads = [...container.querySelectorAll('span[role="columnheader"]')].map(h => h.textContent);
    expect(heads).toEqual(['Avg margin', 'Median margin', 'Seats', '2015', '2020']);
    const row = screen.getByRole('button', { name: /^201521\.1K/ });
    expect([...row.querySelectorAll('[data-cell]')].map(c => c.textContent)).toEqual(['21.1K', '18.8K', '243']);
    const r2 = screen.getByRole('button', { name: /^202015\.0K/ });
    expect([...r2.querySelectorAll('[data-cell]')].map(c => c.textContent)).toEqual(['15.0K', '—', '–']);
    expect([...screen.getByRole('button', { name: /RJD/ }).querySelectorAll('[data-cell]')].map(c => c.textContent)).toEqual(['80/21.1K', '–']);
  });

  it('rows keep hover / lock / select-seat', () => {
    const onHoverRow = vi.fn(); const onLockRow = vi.fn(); const onSelectSeat = vi.fn();
    render(<SummaryFocus vm={mk({ onHoverRow, onLockRow, onSelectSeat })} />);
    const bjp = screen.getByRole('button', { name: /BJP/ });
    fireEvent.mouseEnter(bjp);
    expect(onHoverRow).toHaveBeenLastCalledWith(sections[2].rows[1]);
    fireEvent.click(bjp);
    expect(onLockRow).toHaveBeenCalledWith(sections[2].rows[1]);
    fireEvent.click(screen.getByRole('button', { name: /Sandesh/ }));
    expect(onSelectSeat).toHaveBeenCalledWith('S1');
  });

  it('the layer pills switch layers, with the active one selected', () => {
    const onLayer = vi.fn();
    render(<SummaryFocus vm={mk({ onLayer })} />);
    const group = screen.getByRole('radiogroup', { name: 'Map layers' });
    expect(within(group).getAllByRole('radio').map(r => r.textContent)).toEqual(['Overview', 'Battle', 'Swing', 'History']);
    expect(within(group).getByRole('radio', { name: 'History' }).getAttribute('data-state')).toBe('on');
    fireEvent.click(within(group).getByRole('radio', { name: 'Swing' }));
    expect(onLayer).toHaveBeenCalledWith('swing');
  });

  it('shows the empty state; unmounting clears only a hover a row set', () => {
    const onHoverRow = vi.fn();
    const empty = render(<SummaryFocus vm={mk({ onHoverRow }, [])} />);
    expect(screen.getByText('No data for this layer')).toBeTruthy();
    empty.unmount();
    expect(onHoverRow).not.toHaveBeenCalled();
    const { unmount } = render(<SummaryFocus vm={mk({ onHoverRow })} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /BJP/ }));
    unmount();
    expect(onHoverRow).toHaveBeenLastCalledWith(null);
  });

  it('shows an Alliances | Parties toggle only when the section has an alternative chart, and it switches the chart', () => {
    const spec = (x: string): NonNullable<SummarySection['chart']> => ({ type: 'groupedBar', valueFormat: 'pct', series: [{ id: 'seat', label: 'Seat %', color: '#fff', points: [{ x, y: 10 }] }] });
    const vs: SummarySection = {
      id: 'vote_vs_seats_alliances', titleKey: 'studio_sum_vote_vs_seats_alliances', rows: [{ id: 'alliance:NDA', label: 'NDA', value: 1, valueFormat: 'signed1' }],
      chart: spec('NDA'), chartLabelKey: 'studio_tab_alliances', chartAlt: { labelKey: 'studio_tab_parties', titleKey: 'studio_sum_vote_vs_seats_parties', spec: spec('BJP') },
    };
    const { container } = render(<SummaryFocus vm={mk({}, [vs, sections[2]])} />);
    const toggle = screen.getByRole('radiogroup', { name: 'Vote share vs seats' });
    expect(within(toggle).getByRole('radio', { name: 'Alliances' }).getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('tbody th')!.textContent).toBe('NDA');
    fireEvent.click(within(toggle).getByRole('radio', { name: 'Parties' }));
    expect(container.querySelector('tbody th')!.textContent).toBe('BJP');
    // only the chart's accessible name follows the toggle; the section still describes its alliance rows
    expect(screen.getByRole('img', { name: 'Vote share vs seats · Parties' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Vote share vs seats · Alliances' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Vote share vs seats · Alliances' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Vote share vs seats · Alliances' })).toBeTruthy();
    // a section with a plain chart has no toggle
    cleanup();
    const plain = render(<SummaryFocus vm={mk()} />);
    expect(plain.container.querySelector('[data-chart-toggle]')).toBeNull();
  });
});
