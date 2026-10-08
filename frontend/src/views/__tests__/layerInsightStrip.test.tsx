// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '../../i18n';
import { LayerInsightStrip } from '../dashboard/LayerInsightStrip';
import type { LayerInsightVM } from '../../viewmodels/tiles/useLayerInsightVM';

afterEach(cleanup);

describe('LayerInsightStrip', () => {
  it('tags each chip with its id (live e2e hook)', () => {
    const vm = {
      insight: { headline: 'h', chips: [{ id: 'too_close', label: 'Too close', color: '#fff', count: 3, seatIds: ['a', 'b', 'c'] }] },
      lockedChipId: null, onLockChip: vi.fn(), onHoverChip: vi.fn(), onFocus: vi.fn(),
    } as unknown as LayerInsightVM;
    const { container } = render(<LayerInsightStrip vm={vm} variant="tile" />);
    expect(container.querySelector('button[data-chip="too_close"]')).toBeTruthy();
  });
});
