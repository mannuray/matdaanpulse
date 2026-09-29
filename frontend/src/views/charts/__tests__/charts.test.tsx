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
