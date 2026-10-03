// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HoldsPanel } from './HoldsPanel';

afterEach(cleanup);

describe('HoldsPanel', () => {
  it('lists held seats with time left and releases one', () => {
    const onRelease = vi.fn();
    render(<HoldsPanel holds={[{ const_id: 'S1', const_no: 40, name: 'Sorbhog', round_at_hold: 8, expires_at: new Date(Date.now() + 5 * 60_000).toISOString(), created_by_name: 'Asha' }]} onRelease={onRelease} />);
    expect(screen.getByText(/#40 Sorbhog/)).toBeTruthy();
    expect(screen.getByText(/round 8/)).toBeTruthy();
    expect(screen.getByText(/[45] min left/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Release #40 Sorbhog' }));
    expect(onRelease).toHaveBeenCalledWith('S1');
  });
  it('renders nothing without holds', () => {
    const { container } = render(<HoldsPanel holds={[]} onRelease={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
});
