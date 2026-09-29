// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MobileCardRail } from '../dashboard/MobileCardRail';

describe('MobileCardRail', () => {
  it('renders one snap card per tile with page dots', () => {
    const { container } = render(<MobileCardRail cards={[
      { id: 'insight', title: 'Swing', node: 'a', onOpen: () => {} },
      { id: 'standings', title: 'Parties', node: 'b', onOpen: () => {} },
    ]} />);
    expect(container.querySelectorAll('[data-rail-card]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-rail-dot]')).toHaveLength(2);
  });
});
