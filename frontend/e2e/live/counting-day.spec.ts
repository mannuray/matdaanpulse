/**
 * A simulated counting day seen by a viewer (docs/superpowers/specs/2026-10-08-live-e2e-layer1-design.md).
 * The mock ECI and the worker run from global setup; every check compares the page with the backend snapshot of the
 * version on screen. Screenshots go to e2e/artifacts/live/.
 */
import { test, expect, type Page } from '@playwright/test';
import { SIM } from './env';
import { advanceTo, liveState, shot, waitForViewer, type Snapshot } from './sim';
import { baseline, leadersOf, liveOf } from './oracle';

test.describe.configure({ mode: 'serial' });

const PENDING = 'var(--color-map-pending)';

/** Seat ids whose map fill is not the pending colour. */
const colouredSeats = (page: Page) => page.locator('path.pc[data-seat]').evaluateAll((ps, pending) =>
  ps.filter(p => (p as SVGPathElement).style.fill !== pending).map(p => p.getAttribute('data-seat')!), PENDING);

/** The picker's pinned (Live/Upcoming) entry for the sim election, or null. */
/** Seats drawn with the too-close dashed outline (the browser normalises "3 2" to e.g. "3, 2"). */
const dashedSeats = (page: Page) => page.locator('path.pc[data-seat]').evaluateAll(ps =>
  ps.filter(p => { const d = (p as SVGPathElement).style.strokeDasharray; return !!d && d !== 'none'; }).length);

/** A chip's count (its last span), or 0 when the chip is not shown. */
async function chipCount(page: Page, id: string): Promise<number> {
  const chip = page.locator(`button[data-chip="${id}"]`).first();
  if (await chip.count() === 0) return 0;
  return Number(await chip.locator('span').last().textContent());
}

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

  const excluded = new Set<string>();
  const base = await baseline(request);

  // C1: first leads.
  let snap: Snapshot = await advanceTo(request, 2, excluded);
  await waitForViewer(page, snap.version, 'C1:');
  const lead1 = leadersOf(snap);
  expect(lead1.size, 'C1: snapshot has leads').toBeGreaterThan(0);
  expect(new Set(await colouredSeats(page)), 'C1: coloured seats = seats with a leader in the snapshot').toEqual(new Set(lead1.keys()));
  // The ticker shows its newest event (one line) instead of the waiting line.
  await expect(page.getByText('Waiting for updates'), 'C1: ticker left the waiting line').toHaveCount(0);
  await expect(page.getByText(/ leads in | wins |^Lead switch: |^Upset: /).first(), 'C1: ticker shows a live event').toBeVisible();
  await shot(page, 'C1', 'desktop');

  // C2: mid-count. Watch pulses from here on (lead switches start in round 6).
  const pulses = new Set<string>();
  await page.exposeFunction('__e2ePulse', (kind: string) => { pulses.add(kind); });
  await page.evaluate(() => new MutationObserver(ms => ms.forEach(m => {
    const v = (m.target as Element).getAttribute('data-pulse');
    if (v) (window as unknown as { __e2ePulse: (k: string) => void }).__e2ePulse(v);
  })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-pulse'] }));
  for (let r = 3; r <= 8; r++) { snap = await advanceTo(request, r, excluded); await waitForViewer(page, snap.version, `round ${r}:`); }
  const live2 = liveOf(base, snap);
  const switchedSeats = [...live2.values()].filter(s => (s.lead_changes ?? 0) > 0);
  expect(switchedSeats.length, 'C2: some leads switched by round 8').toBeGreaterThan(0);
  expect([...pulses], 'C2: a switch pulse appeared').toContain('switch');

  // Overview: Too close chip and dashed seats, against the snapshot's live analysis.
  const tooClose = [...live2.values()].filter(s => s.call === 'too_close').length;
  expect(await chipCount(page, 'too_close'), `C2: Too close chip vs snapshot (${tooClose})`).toBe(tooClose);
  const dashed = await dashedSeats(page);
  expect(dashed, `C2: dashed seats vs snapshot too-close (${tooClose})`).toBe(tooClose);
  await shot(page, 'C2', 'desktop');

  // Battle: the live headline and momentum chips.
  await page.getByRole('radio', { name: 'Battle', exact: true }).click();
  const changes = [...live2.values()].reduce((n, s) => n + (s.lead_changes ?? 0), 0);
  await expect(page.getByText(`${changes} lead changes so far`).first(), `C2: Battle headline vs snapshot (${changes})`).toBeVisible();
  for (const mo of ['switched', 'narrowing', 'widening'] as const) {
    const n = [...live2.values()].filter(s => s.momentum === mo).length;
    expect(await chipCount(page, `mo_${mo}`), `C2: ${mo} chip vs snapshot (${n})`).toBe(n);
  }
  await shot(page, 'C2-battle', 'desktop');

  // A switched seat's dialog: round line and margin trend.
  const sw = switchedSeats.find(s => snap.seats?.[s.const_id]?.state === 'counting') ?? switchedSeats[0];
  await page.locator(`path.pc[data-seat="${sw.const_id}"]`).dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('svg[data-margin-trend]'), `C2: margin trend in ${sw.const_id}'s dialog`).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText(/Round \d+( of |\/)\d+/).first(), 'C2: round line in the dialog').toBeVisible();
  await shot(page, 'C2-dialog', 'desktop');
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'Overview', exact: true }).click();

  // Person page of a candidate in a counting seat (new tab: the dashboard keeps its single load).
  const leadRow = snap.results.find(r => r.person_id && r.votes > 0 && snap.seats?.[r.const_id]?.state === 'counting')!;
  const person = await page.context().newPage();
  await person.goto(`/person/${leadRow.person_id}`);
  await expect(person.getByText(/Counting|Leading|Trailing/).first(), 'C2: person page shows the live state').toBeVisible({ timeout: 20_000 });
  await shot(person, 'C2-person', 'desktop');
  await person.close();
});
