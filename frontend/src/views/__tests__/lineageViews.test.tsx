// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '../../i18n';
import { LayerInsightStrip } from '../dashboard/LayerInsightStrip';

describe('lineage in the views', () => {
  afterEach(cleanup);
  it('a split chip in the swing insights is tagged "split"', () => {
    const vm = { layer: 'swing', insight: { layer: 'swing', headlineKey: 'studio_insight_swing', headlineParams: { flipped: 1, total: 2, year: 2019 },
      chips: [{ id: 'split:SHS>SSUBT', label: 'SHS → SSUBT', color: '#f00', count: 1, seatIds: ['X_1'], tag: 'split' }] },
      lockedChipId: null, onLockChip: () => {}, onHoverChip: () => {} } as never;
    render(<LayerInsightStrip vm={vm} variant="tile" />);
    expect(screen.getByText('split')).toBeTruthy();
  });
});
