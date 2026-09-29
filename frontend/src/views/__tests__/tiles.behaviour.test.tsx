// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '../../i18n';
import { StandingsTile } from '../dashboard/StandingsTile';
import { LayerInsightStrip } from '../dashboard/LayerInsightStrip';
import { LeadersStrip } from '../dashboard/LeadersStrip';
import { fitCount } from '../../viewmodels/tiles/fit';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';
import type { LayerInsightVM } from '../../viewmodels/tiles/useLayerInsightVM';
import type { LeadersVM } from '../../viewmodels/tiles/useLeadersVM';

const noop = () => {};
const originals = (['clientHeight', 'clientWidth'] as const).map(k => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)] as const);
afterEach(() => {
  cleanup();
  for (const [k, d] of originals) {
    if (d) Object.defineProperty(HTMLElement.prototype, k, d);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
  }
});

describe('tile behaviour', () => {
  it('standings tile shows only the rows that fit and a "+N more" footer', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 180 });
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: `P${i}`, name: `Party ${i}`, color: '#fff', seats: 12 - i, votePct: null, allianceId: null }));
    const vm: StandingsVM = { rows, allRows: rows, pulse: false, lockedId: null, onFocus: noop, onHoverParty: noop, onLockParty: noop };
    render(<StandingsTile vm={vm} variant="tile" />);
    const { count } = fitCount({ available: 180, itemHeight: 36, gap: 4, footerHeight: 22, total: 12 });
    expect(count).toBe(4);
    expect(screen.getAllByRole('button', { name: /^P\d+ Party/ })).toHaveLength(count);
    const hiddenSeats = rows.slice(count).reduce((s, r) => s + r.seats, 0);
    expect(screen.getByText(`+8 more parties · ${hiddenSeats} seats`)).toBeTruthy();
  });

  it('insight strip renders headline, locks chips and marks the locked one', () => {
    const chips = [
      { id: 'a', label: 'Gained', color: '#0f0', count: 5, seatIds: ['1'] },
      { id: 'b', label: 'Lost', color: '#f00', count: 3, seatIds: ['2'] },
    ];
    const onLockChip = vi.fn();
    const vm: LayerInsightVM = {
      layer: 'swing', insight: { layer: 'swing', headlineKey: 'studio_insight_swing', headlineParams: { flipped: 8, total: 243, year: 2020 }, chips } as LayerInsightVM['insight'],
      lockedChipId: 'b', onFocus: noop, onHoverChip: noop, onLockChip,
    };
    render(<LayerInsightStrip vm={vm} variant="tile" />);
    expect(screen.getByText('8 of 243 seats changed hands vs 2020')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Gained/ }));
    expect(onLockChip).toHaveBeenCalledWith(chips[0]);
    expect(screen.getByRole('button', { name: /Lost/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Gained/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('leaders card selects and hovers its seat', () => {
    const onSelectSeat = vi.fn();
    const onHoverSeat = vi.fn();
    const vm: LeadersVM = {
      leaders: [{ key: 'k', name: 'Test Leader', constId: 'C7', constName: 'Seat', partyId: 'BJP', status: 'LEADING', margin: 100, custom: false }], watchlist: [],
      partyColor: new Map(), seatOptions: [], onFocus: noop, onSelectSeat, onHoverSeat, onAddCustom: noop, onRemoveCustom: noop,
    };
    render(<LeadersStrip vm={vm} variant="tile" />);
    const card = screen.getByRole('button', { name: /Test Leader/ });
    fireEvent.mouseEnter(card);
    expect(onHoverSeat).toHaveBeenLastCalledWith('C7');
    fireEvent.mouseLeave(card);
    expect(onHoverSeat).toHaveBeenLastCalledWith(null);
    fireEvent.click(card);
    expect(onSelectSeat).toHaveBeenCalledWith('C7');
  });

  it('leaders strip reserves the "+N more" chip and the gap before it', () => {
    // 3 cards + 3 gaps (incl. the one before the chip) + 96px chip = 3*248 + 96; 92px wide is 4px short.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 3 * 248 + 92 });
    const leaders = Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, name: `Leader ${i}`, constId: `C${i}`, constName: 'Seat', partyId: 'BJP', status: 'LEADING' as const, margin: 10, custom: false }));
    const vm: LeadersVM = { leaders, watchlist: [], partyColor: new Map(), seatOptions: [], onFocus: noop, onSelectSeat: noop, onHoverSeat: noop, onAddCustom: noop, onRemoveCustom: noop };
    render(<LeadersStrip vm={vm} variant="tile" />);
    expect(screen.getAllByRole('button', { name: /Leader \d/ })).toHaveLength(2);
    expect(screen.getByText('+4 more')).toBeTruthy();
  });

  describe('insight footer variant', () => {
    const chips = [{ id: 'BJP', label: 'BJP', color: '#f70', count: 5, seatIds: ['1'] }];
    const mk = (layer: LayerInsightVM['layer'], key: string, params: Record<string, string | number>, onLockChip = noop): LayerInsightVM => ({
      layer, insight: { layer, headlineKey: key, headlineParams: params, chips } as LayerInsightVM['insight'],
      lockedChipId: null, onFocus: noop, onHoverChip: noop, onLockChip,
    });

    it('shows no headline on overview, only chips and the expand button', () => {
      render(<LayerInsightStrip vm={mk('overview', 'studio_insight_overview', { text: 'NDA 4 · MGB 1' })} variant="footer" />);
      expect(screen.queryByText('NDA 4 · MGB 1')).toBeNull();
      expect(screen.getByRole('button', { name: /BJP/ })).toBeTruthy();
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    it('shows the headline on other layers and chip click locks', () => {
      const onLockChip = vi.fn();
      render(<LayerInsightStrip vm={mk('swing', 'studio_insight_swing', { flipped: 8, total: 243, year: 2020 }, onLockChip)} variant="footer" />);
      expect(screen.getByText('8 of 243 seats changed hands vs 2020')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /BJP/ }));
      expect(onLockChip).toHaveBeenCalledWith(chips[0]);
    });
  });
});
