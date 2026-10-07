// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../i18n';
import { MapTile } from '../MapTile';
import type { MapVM } from '../../../viewmodels/tiles/useMapVM';

const vm = (over: Partial<MapVM> = {}): MapVM => ({
  status: 'ready', features: [], stateFeatures: null, isVS: true, geoConfig: undefined, seatOf: new Map(), fills: new Map(), outline: true, regionOutlines: [],
  recentSeats: new Map(), selectedSeat: null, layer: 'overview', layers: ['overview', 'battle'], mapMode: 'map', hexAvailable: true, lockedLabel: null, legend: null,
  seatInfo: () => null, onLayer: vi.fn(), onMapMode: vi.fn(), onSelect: vi.fn(), onClearLock: vi.fn(), onFocus: vi.fn(), ...over,
} as MapVM);

describe('MapTile', () => {
  it('has no Map / Hex toggle even when a hex file is configured (no hex renderer yet)', () => {
    render(<MapTile vm={vm()} variant="focus" />);
    expect(screen.queryByText('Hex')).toBeNull();
  });
  it('renders the live legend with counts', () => {
    render(<MapTile vm={vm({ legend: [
      { key: 'safe', labelKey: 'map_legend_safe', color: 'var(--color-ink)', count: 120 },
      { key: 'too_close', labelKey: 'map_legend_too_close', color: 'var(--color-muted)', dashed: true, count: 18 },
    ] })} variant="focus" />);
    expect(screen.getByText('Safe')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
  });
});
