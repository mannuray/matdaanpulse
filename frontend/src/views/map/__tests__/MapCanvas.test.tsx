// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '../../../i18n';
import { MapCanvas } from '../MapCanvas';
import type { MapVM } from '../../../viewmodels/tiles/useMapVM';
import type { GeoFeature } from '../../../model/geo/geoHelpers';

const feature = {
  type: 'Feature',
  properties: { pc_name: 'Sandesh', st_name: 'Bihar' },
  geometry: { type: 'Polygon', coordinates: [[[84, 25], [85, 25], [85, 26], [84, 26], [84, 25]]] },
} as unknown as GeoFeature;

function makeVM(): MapVM {
  return {
    status: 'ready', features: [feature], stateFeatures: null, isVS: true, geoConfig: undefined,
    seatOf: new Map([[feature, 'S1']]), fills: new Map([['S1', { color: '#1FA37A', opacity: 1, highlighted: false }]]), outline: true,
    recentSeats: new Set(), selectedSeat: null, layer: 'overview', layers: ['overview'], mapMode: 'map',
    hexAvailable: false, lockedLabel: null,
    seatInfo: () => ({ name: 'Sandesh', candidate: 'A', party: 'JDU', status: 'Won', color: '#1FA37A' }),
    onLayer: vi.fn(), onMapMode: vi.fn(), onSelect: vi.fn(), onClearLock: vi.fn(), onFocus: vi.fn(),
  };
}

describe('MapCanvas', () => {
  it('portals the tooltip to document.body and outlines the hovered seat', () => {
    const { container } = render(<MapCanvas vm={makeVM()} />);
    const path = container.querySelector('path.pc') as SVGPathElement;
    expect(path).toBeTruthy();
    expect(path.style.vectorEffect).toBe('non-scaling-stroke');
    fireEvent.mouseMove(path, { clientX: 10, clientY: 20 });
    const tip = document.body.querySelector('.studio-root.fixed') as HTMLElement;
    expect(tip).toBeTruthy();
    expect(container.contains(tip)).toBe(false);
    expect(tip.parentElement).toBe(document.body);
    expect(path.style.stroke).toBe('var(--color-ink)');
    expect(path.style.fillOpacity).toBe('1');
    fireEvent.mouseLeave(path);
    expect(document.body.querySelector('.studio-root.fixed')).toBeNull();
    expect(path.style.stroke).toBe('var(--color-map-stroke)');
  });

  it('marks highlighted seats and draws a top-layer outline for them only', () => {
    const vm = makeVM();
    vm.fills = new Map([['S1', { color: '#1FA37A', opacity: 1, highlighted: true }]]);
    const { container } = render(<MapCanvas vm={vm} />);
    const path = container.querySelector('path.pc') as SVGPathElement;
    expect(path.getAttribute('data-highlighted')).toBe('true');
    const outline = container.querySelectorAll('g.pc-highlight path');
    expect(outline).toHaveLength(1);
    expect((outline[0] as SVGPathElement).style.stroke).toBe('var(--color-ink)');
    expect(outline[0].getAttribute('d')).toBe(path.getAttribute('d'));
  });
  it('the outline layer sits above the seats and below state borders and labels', () => {
    const vm = makeVM();
    vm.fills = new Map([['S1', { color: '#1FA37A', opacity: 1, highlighted: true }]]);
    const { container } = render(<MapCanvas vm={vm} />);
    const kids = [...container.querySelector('g.pc-highlight')!.parentElement!.children];
    const at = (sel: string) => kids.findIndex(k => k.matches(sel));
    expect(at('g.pc-highlight')).toBeGreaterThan(at('path.pc'));
    expect(at('g.pc-highlight')).toBeLessThan(at('text.pc-label'));
  });
  it('a large highlight keeps full opacity and the marker but draws no outline', () => {
    const vm = makeVM();
    vm.fills = new Map([['S1', { color: '#1FA37A', opacity: 1, highlighted: true }]]);
    vm.outline = false;
    const { container } = render(<MapCanvas vm={vm} />);
    expect(container.querySelector('path.pc')!.getAttribute('data-highlighted')).toBe('true');
    expect(container.querySelectorAll('g.pc-highlight path')).toHaveLength(0);
  });
  it('keeps the outline element across tooltip hovers', () => {
    const vm = makeVM();
    vm.fills = new Map([['S1', { color: '#1FA37A', opacity: 1, highlighted: true }]]);
    const { container } = render(<MapCanvas vm={vm} />);
    const before = container.querySelector('g.pc-highlight path');
    fireEvent.mouseMove(container.querySelector('path.pc')!, { clientX: 5, clientY: 5 });
    expect(container.querySelector('g.pc-highlight path')).toBe(before);
  });
  it('no highlight: no marker and no outline', () => {
    const { container } = render(<MapCanvas vm={makeVM()} />);
    expect((container.querySelector('path.pc') as SVGPathElement).hasAttribute('data-highlighted')).toBe(false);
    expect(container.querySelectorAll('g.pc-highlight path')).toHaveLength(0);
  });
});
