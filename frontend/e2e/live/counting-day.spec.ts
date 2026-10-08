/**
 * A simulated counting day seen by a viewer (docs/superpowers/specs/2026-10-08-live-e2e-layer1-design.md).
 * The mock ECI and the worker run from global setup; every check compares the page with the backend snapshot of the
 * version on screen. Screenshots go to e2e/artifacts/live/.
 */
import { test, expect, type Page } from '@playwright/test';
import { SIM } from './env';
import { liveState, shot } from './sim';

test.describe.configure({ mode: 'serial' });

const PENDING = 'var(--color-map-pending)';

/** Seat ids whose map fill is not the pending colour. */
const colouredSeats = (page: Page) => page.locator('path.pc[data-seat]').evaluateAll((ps, pending) =>
  ps.filter(p => (p as SVGPathElement).style.fill !== pending).map(p => p.getAttribute('data-seat')!), PENDING);

/** The picker's pinned (Live/Upcoming) entry for the sim election, or null. */
async function pinnedSim(page: Page): Promise<boolean> {
  await page.getByRole('button', { name: /^Choose election/ }).click();
  const pinned = await page.getByRole('button', { name: /2027 · / }).count();
  await page.keyboard.press('Escape');
  return pinned > 0;
}

test('counting day, desktop', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Full document loads only (the SPA's own URL updates are same-document navigations, not reloads).
  let loads = 0;
  page.on('load', () => { loads++; });

  // C0: Live, nothing counted.
  const live0 = await liveState(request);
  expect(live0.status, 'C0: status').toBe('Live');
  expect(live0.declared, 'C0: declared').toBe(0);
  await page.goto(`/election/${SIM}`);
  await expect(page.getByText('Waiting for updates'), 'C0: waiting line').toBeVisible({ timeout: 30_000 });
  await expect(page.locator('path.pc[data-seat]').first(), 'C0: map drawn').toBeAttached({ timeout: 30_000 });
  expect(await colouredSeats(page), 'C0: seats coloured before any result').toEqual([]);
  expect(await pinnedSim(page), 'C0: the picker pins the Live election').toBe(true);
  await shot(page, 'C0', 'desktop');
  expect(loads, 'C0: one page load').toBe(1);
});
