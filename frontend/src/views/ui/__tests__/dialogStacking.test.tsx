// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import '../../../i18n';
import { DetailDialog } from '../DetailDialog';
import { FocusDialog } from '../FocusDialog';
import { BottomSheet } from '../BottomSheet';

let desktop = true;
beforeAll(() => { window.matchMedia = vi.fn().mockImplementation(() => ({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never; });
afterEach(() => { cleanup(); desktop = true; });

const overlays = () => [...document.body.querySelectorAll<HTMLElement>('.bg-scrim')];
// The earlier dialog is aria-hidden once a later modal opens, so find it by its title text, not by role.
const content = (title: string) => [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')].find(d => d.querySelector('h2')?.textContent === title)!;
const follows = (a: Element, b: Element) => Boolean(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
const z = (el: Element) => el.className.split(/\s+/).find(c => /^z-\d+$/.test(c));

/** Opens the second dialog after the first, like a party dialog opened from the seat dialog. */
function Stack({ first }: { first: 'focus' | 'detail' }) {
  const [second, setSecond] = useState(false);
  return (
    <>
      {first === 'focus'
        ? <FocusDialog open title="Map" onClose={() => {}}><button type="button" onClick={() => setSecond(true)}>open</button></FocusDialog>
        : <DetailDialog open title="Seat" onClose={() => {}}><button type="button" onClick={() => setSecond(true)}>open</button></DetailDialog>}
      {second && <DetailDialog open title="Party" onClose={() => {}}><p>party</p></DetailDialog>}
    </>
  );
}

describe('stacked dialogs', () => {
  it.each(['focus', 'detail'] as const)('a dialog opened over a %s dialog dims it: its overlay comes after the earlier content at the same z', async first => {
    render(<Stack first={first} />);
    fireEvent.click(screen.getByText('open'));
    await screen.findByRole('dialog', { name: 'Party' });
    {
      const earlier = content(first === 'focus' ? 'Map' : 'Seat');
      const [, secondOverlay] = overlays();
      expect(overlays()).toHaveLength(2);
      expect(follows(secondOverlay, earlier)).toBe(true);
      expect(follows(content('Party'), secondOverlay)).toBe(true);
      expect(z(secondOverlay)).toBe(z(earlier));
      expect(z(secondOverlay)).toBe('z-50');
    }
  });

  it('the mobile bottom sheet overlay shares its content z too', () => {
    desktop = false;
    render(<BottomSheet open onOpenChange={() => {}} title="Sheet"><p>x</p></BottomSheet>);
    expect(z(overlays()[0])).toBe(z(content('Sheet')));
  });
});
