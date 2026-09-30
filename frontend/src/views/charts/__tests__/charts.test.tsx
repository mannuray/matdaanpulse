// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '../../../i18n';
import { BarChart } from '../BarChart';
import { GroupedBarChart } from '../GroupedBarChart';
import { LineChart } from '../LineChart';
import { niceScale } from '../shared';
import type { ChartSpec } from '../../../viewmodels/tiles/useSummaryVM';

afterEach(cleanup);

const bar: ChartSpec = { type: 'bar', series: [{ id: 'seats', label: 'Seats', labelKey: 'studio_col_seats', color: '#8B7CFF', points: [{ x: '< 1K', y: 2 }, { x: '1–5K', y: 1 }, { x: '5K+', y: 4 }] }] };
const grouped: ChartSpec = { type: 'groupedBar', series: [
  { id: 'NDA', label: 'NDA', color: '#f70', points: [{ x: '< 1K', y: 1 }, { x: '5K+', y: 3 }] },
  { id: 'MGB', label: 'MGB', color: '#0a0', points: [{ x: '< 1K', y: 2 }, { x: '5K+', y: 0 }] },
] };
const line: ChartSpec = { type: 'line', series: [
  { id: 'avg', label: 'Average', labelKey: 'studio_col_avg_margin', color: '#8B7CFF', points: [{ x: 2015, y: 21000 }, { x: 2020, y: 18800 }, { x: 2025, y: 25000 }] },
  { id: 'median', label: 'Median', color: '#ff0', points: [{ x: 2015, y: 15000 }, { x: 2020, y: 12000 }, { x: 2025, y: 16000 }] },
] };

describe('charts', () => {
  it('BarChart: role img with the title, one bar and value label per category, hidden table rows', () => {
    const { container } = render(<BarChart spec={bar} title="Margin distribution" />);
    expect(screen.getByRole('img', { name: 'Margin distribution' })).toBeTruthy();
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(3);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(container.querySelector('table')!.className).toContain('sr-only');
    expect(container.querySelector('caption')!.textContent).toBe('Margin distribution');
    expect(container.querySelector('thead')!.textContent).toContain('Seats');
    expect(container.querySelector('[data-bar] text')!.textContent).toBe('2');
    expect(container.querySelector('[data-chart-legend]')).toBeNull();
  });

  it('GroupedBarChart: series x categories bars, a legend and both series in the table', () => {
    const { container } = render(<GroupedBarChart spec={grouped} title="By bloc" />);
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(4);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.querySelector('[data-chart-legend]')!.textContent).toBe('NDAMGB');
    expect([...container.querySelectorAll('tbody tr')[1].querySelectorAll('td')].map(td => td.textContent)).toEqual(['3', '0']);
  });

  it('LineChart: a polyline per series, a dot per point, legend and table by year', () => {
    const { container } = render(<LineChart spec={line} title="Margin trend" />);
    expect(screen.getByRole('img', { name: 'Margin trend' })).toBeTruthy();
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
    expect(container.querySelectorAll('[data-point]')).toHaveLength(6);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(container.querySelector('[data-chart-legend]')!.textContent).toBe('Avg marginMedian');
  });

  it('GroupedBarChart: per-point colour, series opacity, annotations above each group and in the table', () => {
    const spec: ChartSpec = {
      type: 'groupedBar', valueFormat: 'pct',
      series: [
        { id: 'vote', label: 'Vote %', labelKey: 'studio_col_vote_pct', color: '#fff', opacity: 0.4, points: [{ x: 'NDA', y: 50, color: '#f70' }, { x: 'MGB', y: 30, color: '#0a0' }] },
        { id: 'seat', label: 'Seat %', labelKey: 'studio_col_seat_pct', color: '#fff', points: [{ x: 'NDA', y: 55.5, color: '#f70' }, { x: 'MGB', y: 25, color: '#0a0' }] },
      ],
      annotations: [{ x: 'NDA', text: '+5.5', tone: 'up' }, { x: 'MGB', text: '−5.0', tone: 'down' }],
    };
    const { container } = render(<GroupedBarChart spec={spec} title="Vote vs seats" />);
    const rects = [...container.querySelectorAll('[data-bar] rect')];
    expect(rects.map(r => r.getAttribute('fill'))).toEqual(['#f70', '#f70', '#0a0', '#0a0']);
    expect(rects.map(r => r.getAttribute('fill-opacity'))).toEqual(['0.4', null, '0.4', null]);
    const notes = [...container.querySelectorAll('[data-annotation]')];
    expect(notes.map(n => [n.textContent, n.getAttribute('data-annotation'), n.getAttribute('fill')])).toEqual([
      ['+5.5', 'up', 'var(--color-ok-text)'], ['−5.0', 'down', 'var(--color-live-text)'],
    ]);
    expect(container.querySelector('thead')!.textContent).toContain('Note');
    // table cells use the drawing's format with its unit
    expect([...container.querySelectorAll('tbody tr')[1].querySelectorAll('td')].map(td => td.textContent)).toEqual(['30.0%', '25.0%', '−5.0']);
    expect(container.querySelector('[data-chart-legend]')!.textContent).toBe('Vote %Seat %');
    expect(container.querySelector('[data-bar] text')!.textContent).toBe('50.0');
  });

  it('GroupedBarChart: valueFormat int / compact labels; many groups scroll inside the box', () => {
    const many: ChartSpec = { type: 'groupedBar', valueFormat: 'compact', series: [{ id: 'a', label: 'A', color: '#f70', points: Array.from({ length: 12 }, (_, i) => ({ x: `P${i}`, y: 21100 })) }] };
    const { container } = render(<GroupedBarChart spec={many} title="Many" />);
    expect(container.querySelector('[data-bar] text')!.textContent).toBe('21.1K');
    expect(container.querySelector('[data-chart-scroll]')).toBeTruthy();
    expect(Number(container.querySelector('svg')!.getAttribute('width'))).toBeGreaterThanOrEqual(12 * 52);
    cleanup();
    const few = render(<GroupedBarChart spec={grouped} title="Few" />);
    expect(few.container.querySelector('[data-chart-scroll]')).toBeNull();
  });

  it('a scrolling chart box is a focusable labelled region', () => {
    const many: ChartSpec = { type: 'groupedBar', series: [{ id: 'a', label: 'A', color: '#f70', points: Array.from({ length: 12 }, (_, i) => ({ x: `P${i}`, y: 1 })) }] };
    render(<GroupedBarChart spec={many} title="Many groups" />);
    const box = screen.getByRole('region', { name: 'Many groups' });
    expect(box.getAttribute('tabindex')).toBe('0');
    expect(box.hasAttribute('data-chart-scroll')).toBe(true);
  });

  it('x labels: a short axis label with the full name in the tooltip and the table; long labels are clipped; only a labelKey is translated', () => {
    const spec: ChartSpec = { type: 'groupedBar', series: [{ id: 'a', label: 'A', color: '#f70', points: [
      { x: 'BJP', y: 3, label: 'Bharatiya Janata Party' },
      { x: 'others', y: 2, labelKey: 'others' },
      { x: 'National Democratic Alliance of Many Words', y: 1 },
    ] }] };
    const { container } = render(<GroupedBarChart spec={spec} title="T" />);
    const axis = [...container.querySelectorAll('text')].filter(t => t.querySelector(':scope > title'));
    const texts = axis.map(a => a.textContent);
    expect(texts[0]).toContain('BJP');
    expect(axis[0].querySelector('title')!.textContent).toBe('Bharatiya Janata Party');
    expect(texts[1]).toContain('Others');
    expect(texts[2]).toContain('…');
    expect(axis[2].querySelector('title')!.textContent).toBe('National Democratic Alliance of Many Words');
    expect([...container.querySelectorAll('tbody th')].map(t => t.textContent)).toEqual(['Bharatiya Janata Party', 'Others', 'National Democratic Alliance of Many Words']);
    // a plain x that merely looks like an i18n key is left alone
    cleanup();
    const plain = render(<GroupedBarChart spec={{ type: 'groupedBar', series: [{ id: 'a', label: 'A', color: '#f70', points: [{ x: 'others', y: 1 }] }] }} title="P" />);
    expect(plain.container.querySelector('tbody th')!.textContent).toBe('others');
  });

  it('BarChart: per-point colour and annotation', () => {
    const spec: ChartSpec = { type: 'bar', series: [{ id: 's', label: 'S', color: '#111', points: [{ x: 'a', y: 2, color: '#f70' }] }], annotations: [{ x: 'a', text: '0.0', tone: 'neutral' }] };
    const { container } = render(<BarChart spec={spec} title="One" />);
    expect(container.querySelector('rect')!.getAttribute('fill')).toBe('#f70');
    expect(container.querySelector('[data-annotation="neutral"]')!.textContent).toBe('0.0');
  });

  it('handles an empty spec without throwing', () => {
    const { container } = render(<LineChart spec={{ type: 'line', series: [] }} title="Empty" />);
    expect(container.querySelectorAll('[data-point]')).toHaveLength(0);
  });

  it('niceScale rounds the top up to a tidy tick', () => {
    expect(niceScale(21000).top).toBe(30000);
    expect(niceScale(4).ticks).toEqual([0, 1, 2, 3, 4]);
    expect(niceScale(0).top).toBe(1);
  });
});
