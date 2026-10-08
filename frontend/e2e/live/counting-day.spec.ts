/**
 * A simulated counting day seen by a viewer (docs/superpowers/specs/2026-10-08-live-e2e-layer1-design.md).
 * The mock ECI and the worker run from global setup; every check compares the page with the backend snapshot of the
 * version on screen. Screenshots go to e2e/artifacts/live/.
 */
import { test, expect, type Page } from '@playwright/test';
import { SIM } from './env';
import { adminSeats, advanceTo, correct, holds, liveState, releaseHold, shot, snapshot, waitForViewer, type Snapshot } from './sim';
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

  // C3: special seat states at round 10, set by the admin seat correction (as on counting day).
  snap = await advanceTo(request, 10, excluded);
  const roster = await adminSeats(request);
  const countingIds = roster.filter(s => snap.seats?.[s.const_id]?.state === 'counting' && s.candidates.filter(c => c.votes > 0).length >= 2).map(s => s.const_id);
  const [cmId, adjId, heldId, otherCounting] = countingIds;
  const rosterVotes = (id: string, over: Record<string, number> = {}) =>
    Object.fromEntries(roster.find(s => s.const_id === id)!.candidates.map(c => [c.candidate_id, over[c.candidate_id] ?? c.votes]));
  const [hA, hB] = [...roster.find(s => s.const_id === heldId)!.candidates].sort((a, b) => b.votes - a.votes);
  const heldVotes = hA.votes + 777;
  for (const id of [cmId, adjId, heldId]) excluded.add(id);
  try {
    await correct(request, cmId, 'countermanded', rosterVotes(cmId));
    await correct(request, adjId, 'adjourned', rosterVotes(adjId));
    await correct(request, heldId, 'counting', rosterVotes(heldId, { [hB.candidate_id]: heldVotes }), (() => { const st = snap.seats?.[heldId]; return st?.cr && st.tr ? { current: st.cr, total: st.tr } : null; })());
    const v3 = (await liveState(request)).version;
    await waitForViewer(page, v3, 'C3:');
    for (const [id, text, name] of [[cmId, 'Countermanded', 'countermanded'], [adjId, 'Counting adjourned', 'adjourned']] as const) {
      await page.locator(`path.pc[data-seat="${id}"]`).dispatchEvent('click');
      await expect(page.getByRole('dialog').getByText(text).first(), `C3: ${id}'s dialog says ${text}`).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('dialog').getByText('Not started'), `C3: ${id}'s dialog shows no call badge`).toHaveCount(0);
      await shot(page, `C3-${name}`, 'desktop');
      await page.keyboard.press('Escape');
    }
    await page.locator(`path.pc[data-seat="${heldId}"]`).dispatchEvent('click');
    await expect(page.getByRole('dialog').getByText(heldVotes.toLocaleString('en-IN')).first(), `C3: held seat ${heldId} shows the corrected ${heldVotes}`).toBeVisible({ timeout: 15_000 });
    await shot(page, 'C3-held', 'desktop');
    await page.keyboard.press('Escape');

    // While the source stays at round 10 the holds protect the corrections (ingest spec D4). The worker polls every
    // 3 s, so two cycles have run after this wait: absence of change needs a window, not a condition.
    await page.waitForTimeout(8_000);
    const held = await snapshot(request, (await liveState(request)).version);
    expect(held.seats?.[cmId]?.state, `C3: ${cmId} stays countermanded under its hold`).toBe('countermanded');
    expect(held.seats?.[adjId]?.state, `C3: ${adjId} stays adjourned under its hold`).toBe('adjourned');
    expect(held.results.some(r => r.const_id === heldId && r.votes === heldVotes), `C3: ${heldId} keeps ${heldVotes} under its hold`).toBe(true);
    expect((await holds(request)).sort(), 'C3: three seats on hold').toEqual([cmId, adjId, heldId].sort());

    // A later source round releases the holds by itself: the seats follow the source again (settle checks them).
    excluded.clear();
    snap = await advanceTo(request, 11, excluded);
    expect(await holds(request), 'C3: holds released by the later round').toEqual([]);

    // C4: partial declarations at round 18.
    snap = await advanceTo(request, 18, excluded);
    await waitForViewer(page, snap.version, 'C4:');
    const lead4 = leadersOf(snap);
    const declared = [...lead4].filter(([, l]) => l.won).map(([id]) => id);
    expect(declared.length, 'C4: some seats declared by round 18').toBeGreaterThan(0);
    expect(declared.length, 'C4: not all seats declared by round 18').toBeLessThan(lead4.size);
    const declaredOnPage = Number((await page.getByText(/^\d+\/243$/).first().textContent())!.split('/')[0]);
    expect(declaredOnPage, `C4: declared count vs snapshot (${declared.length})`).toBe(declared.length);
    await expect(page.getByText(/\d+ to win/).first(), 'C4: majority line').toBeVisible();
    // Party standings: won + leading per party, as in the snapshot summary.
    await page.getByRole('radio', { name: 'Parties', exact: true }).click();
    for (const p of snap.summary.filter(x => (x.won ?? 0) + (x.leading ?? 0) > 0).slice(0, 4)) {
      const n = (p.won ?? 0) + (p.leading ?? 0);
      await expect(page.getByRole('button', { name: new RegExp(`^${p.party_id} .* ${n}$`) }).first(), `C4: standings ${p.party_id} = ${n}`).toBeVisible();
    }
    // Key leaders follow the count: a leader whose seat is counting or declared is not "Pending".
    const leader = page.getByRole('button', { name: /^Samrat Choudhary · / }).first();
    await expect(leader, 'C4: Samrat Choudhary (Tarapur) shows a live status, not Pending').toHaveAccessibleName(/ · (Leading|Trailing|Won|Lost)$/);
    await shot(page, 'C4', 'desktop');
    await page.getByRole('radio', { name: 'Summary · Overview' }).click();

    // Constituency pages of a declared and a counting seat (new tab).
    const cp = await page.context().newPage();
    for (const [id, kind] of [[declared[0], 'declared'], [otherCounting, 'counting']] as const) {
      await cp.goto(`/election/${SIM}/constituency/${id}`);
      await expect(cp.getByRole('heading', { level: 1 }), `C4: constituency page ${id}`).toBeVisible({ timeout: 20_000 });
      await expect(cp.getByText(kind === 'declared' ? /Won|Declared/ : /Counting|Leading/).first(), `C4: ${kind} constituency page shows its state`).toBeVisible();
      await shot(cp, `C4-constituency-${kind}`, 'desktop');
    }
    await cp.close();
  } finally {
    for (const id of [cmId, adjId, heldId]) await releaseHold(request, id);
  }
});
