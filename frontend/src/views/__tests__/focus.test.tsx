// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '../../i18n';
import { Tile } from '../dashboard/Tile';
import { FocusOverlay } from '../dashboard/FocusOverlay';

afterEach(cleanup);

const titles = { map: 'Map', scoreboard: 'Results', standings: 'Standings', insight: 'Insight', leaders: 'Leaders', stats: 'Stats' };

describe('Tile + FocusOverlay', () => {
  it('tile expand button calls onExpand', () => {
    const onExpand = vi.fn();
    render(<Tile title="Party standings" onExpand={onExpand}>x</Tile>);
    fireEvent.click(screen.getByRole('button', { name: /expand party standings/i }));
    expect(onExpand).toHaveBeenCalled();
  });
  it('overlay renders the focused tile and closes on Escape', () => {
    const onClose = vi.fn();
    render(<FocusOverlay tile="standings" titles={titles} onClose={onClose} render={t => <p>content {t}</p>} />);
    expect(screen.getByText('content standings')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('renders nothing when no tile is focused', () => {
    const { container } = render(<FocusOverlay tile={null} titles={titles} onClose={() => {}} render={() => 'x'} />);
    expect(container.textContent).toBe('');
  });
});

describe('focus restoration', () => {
  it('returns focus to the expand button after the overlay closes', async () => {
    function Harness() {
      const [tile, setTile] = useState<'standings' | null>(null);
      return (
        <>
          <Tile title="Party standings" onExpand={() => setTile('standings')}>x</Tile>
          <FocusOverlay tile={tile} titles={titles} onClose={() => setTile(null)} render={() => <p>body</p>} />
        </>
      );
    }
    render(<Harness />);
    const btn = screen.getByRole('button', { name: /expand party standings/i });
    btn.focus();
    fireEvent.click(btn);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(btn));
  });
});
