import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const WB_2021 = 'd4e5f6a7-b8c9-0123-def0-345678901021';
const BIHAR = 'c3d4e5f6-a7b8-9012-cdef-234567890abc';
let LS_ID = '';

test.beforeAll(async ({ request }) => {
  const res = await request.get('http://localhost:3082/api/v1/elections');
  const body = await res.json() as { data: { id: string; type: string; year: number }[] };
  LS_ID = body.data.find(e => e.type === 'LS' && e.year === 2024)!.id;
});
const SIZES = [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }];

async function assertNoScroll(page: Page) {
  const r = await page.evaluate(() => ({ sh: document.scrollingElement!.scrollHeight, ih: innerHeight, sw: document.scrollingElement!.scrollWidth, iw: innerWidth }));
  expect(r.sh).toBeLessThanOrEqual(r.ih);
  expect(r.sw).toBeLessThanOrEqual(r.iw);
  const overflowing = await page.evaluate(() => [...document.querySelectorAll('.studio-root section')].filter(el => el.scrollHeight > el.clientHeight + 1).length);
  expect(overflowing).toBe(0);
}

for (const size of SIZES) {
  test(`no page scroll at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`/election/${BIHAR}`);
    await expect(page.getByText('202').first()).toBeVisible();
    await assertNoScroll(page);
    await page.screenshot({ path: `e2e/__shots__/studio-${size.width}x${size.height}.png` });
  });
}

test('focus overlay opens from a tile, is linkable and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}`);
  await page.getByRole('radio', { name: 'Parties' }).click();
  await page.getByRole('button', { name: /expand party standings/i }).click();
  await expect(page).toHaveURL(/focus=standings/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/focus=/);
});

test('Back after closing the focus view does not reopen it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${LS_ID}`);
  await expect(page.getByText('202').first().or(page.getByText('2024').first())).toBeVisible();
  await page.goto(`/election/${BIHAR}`);
  await page.getByRole('radio', { name: 'Parties' }).click();
  await page.getByRole('button', { name: /expand party standings/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/election/${LS_ID}`));
  await expect(page).not.toHaveURL(/focus=/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('bad URL params fall back to defaults', async ({ page }) => {
  await page.goto(`/election/${BIHAR}?layer=bogus&focus=nope&seat=NOT_A_SEAT`);
  await expect(page.getByText('202').first()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('swing layer shows the real flip count', async ({ page }) => {
  await page.goto(`/election/${BIHAR}?layer=swing`);
  await expect(page.getByText(/111 of 243 seats changed hands/)).toBeVisible();
});

test('map focus view fits the dialog without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}`);
  await page.getByRole('button', { name: /expand constituency map/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(500);
  const r = await dialog.evaluate(el => {
    const body = [...el.querySelectorAll('div')].find(d => getComputedStyle(d).overflowY === 'auto' && d.classList.contains('flex-1'))!;
    const svgH = Math.max(0, ...[...el.querySelectorAll('svg')].map(s => s.getBoundingClientRect().height));
    return { sh: body.scrollHeight, ch: body.clientHeight, svgH };
  });
  expect(r.svgH).toBeGreaterThan(200);
  expect(r.sh).toBeLessThanOrEqual(r.ch + 1);
});

test('Lok Sabha 2024 renders without scroll and offers the States layer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${LS_ID}`);
  await expect(page.getByRole('radio', { name: /states/i })).toBeVisible();
  await assertNoScroll(page);
});

test('baseline screenshot for side-by-side comparison', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`http://localhost:3086/election/${BIHAR}`);
  await page.screenshot({ path: 'e2e/__shots__/baseline-1440x900.png' });
});

test('track a seat in the map focus and see it in the Watchlist tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}`);
  await page.evaluate(id => localStorage.removeItem(`watchlist_${id}`), BIHAR);
  await page.goto(`/election/${BIHAR}?focus=map&seat=BR_VS_100_BARAULI`);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const track = dialog.getByRole('button', { name: '☆ Track' });
  await expect(track).toBeVisible();
  await track.click();
  await expect(dialog.getByRole('button', { name: '★ Tracked' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('radio', { name: /Watchlist \(1\)/ }).click();
  await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(1);
  await expect(page.getByText(/barauli/i).first()).toBeVisible();
  await assertNoScroll(page);
  await page.screenshot({ path: 'e2e/__shots__/watchlist-tab.png' });
});

test('side card shows the Summary tab by default and follows the map layer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}`);
  await expect(page.getByRole('radio', { name: 'Summary · Overview' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Parties' })).not.toBeChecked();
  await expect(page.getByRole('heading', { name: 'Election summary', level: 2 })).toBeVisible();
  // Key stats first, then the old Overview order.
  await expect(page.getByText('Avg Margin')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Margin distribution' })).toBeVisible();
  await page.getByRole('radio', { name: 'Swing', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Summary · Swing' })).toBeChecked();
  await expect(page.getByRole('heading', { name: /Flipped seats \(111\)/ })).toBeVisible();
  await assertNoScroll(page);
  await page.getByRole('radio', { name: 'Parties' }).click();
  await expect(page.getByRole('heading', { name: 'Party Standings', level: 2 })).toBeVisible();
});

test('summary focus opens from the tile expand button with charts, switches layers and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}?layer=history`);
  await expect(page.getByRole('radio', { name: 'Summary · History' })).toBeChecked();
  await page.getByRole('button', { name: /expand election summary/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Summary · History', level: 2 })).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'Margin trend' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Party seats over elections' })).toBeVisible();
  await page.screenshot({ path: 'e2e/__shots__/summary-focus-history.png' });
  // The pills inside the focus switch the layer and the content follows.
  await dialog.getByRole('radio', { name: 'Battle' }).click();
  await expect(dialog.getByRole('heading', { name: 'Summary · Battle', level: 2 })).toBeVisible();
  await expect(dialog.getByRole('img', { name: /Margin distribution · / })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // The chosen layer stays after closing.
  await expect(page.getByRole('radio', { name: 'Summary · Battle' })).toBeChecked();
  await assertNoScroll(page);
});

test('at 1024x768 the standings tabs fit: short Summary label, all three tabs visible, nothing clipped', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`/election/${BIHAR}?layer=history`);
  const group = page.getByRole('radiogroup', { name: 'Party Standings' });
  await expect(group).toBeVisible();
  for (const name of ['Summary', 'Parties', /Watchlist/]) await expect(group.getByRole('radio', { name })).toBeVisible();
  const r = await group.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, psw: el.parentElement!.scrollWidth, pcw: el.parentElement!.clientWidth, h2: (el.closest('section')!.querySelector('h2') as HTMLElement).scrollWidth <= (el.closest('section')!.querySelector('h2') as HTMLElement).clientWidth }));
  expect(r.sw).toBeLessThanOrEqual(r.cw);
  expect(r.psw).toBeLessThanOrEqual(r.pcw);
  expect(r.h2).toBe(true);
  await assertNoScroll(page);
  await page.screenshot({ path: '../.playwright-mcp/fix2-1024.png' });
});

test('expanding the Watchlist tab opens the focus on the Watchlist, and Summary still opens the summary focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}`);
  await page.getByRole('radio', { name: /Watchlist/ }).click();
  await page.getByRole('button', { name: /expand watchlist/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Watchlist', level: 2 }).first()).toBeVisible();
  await expect(dialog.getByRole('radio', { name: /Watchlist/ })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('radio', { name: /^Summary/ }).click();
  await page.getByRole('button', { name: /expand election summary/i }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: /^Summary · /, level: 2 })).toBeVisible();
});

test('mobile rail summary card previews the key stats (not the insight strip) and opens the summary focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/election/${BIHAR}`);
  const card = page.getByRole('group', { name: 'Election summary' });
  await expect(card).toContainText('Avg Margin');
  await expect(card.locator('[data-stats]')).toBeVisible();
  await expect(card.getByText('⤢')).toHaveCount(0);
  await assertNoScroll(page);
  await page.screenshot({ path: '../.playwright-mcp/fix2-390.png' });
  await card.getByRole('button', { name: /open election summary/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

const MOBILE_SIZES = [{ width: 390, height: 844 }, { width: 360, height: 740 }];
const box = async (loc: import('@playwright/test').Locator) => (await loc.boundingBox())!;
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

for (const size of MOBILE_SIZES) {
  test.describe(`mobile clean-up at ${size.width}x${size.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/election/${BIHAR}`);
      await expect(page.locator('[data-rail-card]').first()).toBeVisible();
    });

    test('one-row top bar, tiles do not overlap, no page scroll, full bloc labels', async ({ page }) => {
      const top = await box(page.locator('header').first());
      const board = await box(page.locator('[data-mobile-scoreboard]'));
      const map = await box(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Constituency Map' }) }));
      const rail = await box(page.locator('[data-rail]'));
      expect(top.height).toBeLessThanOrEqual(56);
      const boxes = { top, board, map, rail };
      const names = Object.keys(boxes) as (keyof typeof boxes)[];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        expect(overlaps(boxes[names[i]], boxes[names[j]]), `${names[i]} overlaps ${names[j]}`).toBe(false);
      }
      expect(board.height, 'scoreboard tile height').toBeLessThanOrEqual(160);
      expect(map.height, 'map tile height').toBeGreaterThanOrEqual(280);
      await assertNoScroll(page);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('[data-bloc-label]')].map(el => {
        const btn = el.closest('button')!;
        const row = btn.parentElement!;
        const rr = row.getBoundingClientRect();
        return { t: el.textContent, btnOk: btn.scrollWidth <= btn.clientWidth + 1, rowOk: row.scrollWidth <= row.clientWidth + 1, inRow: el.getBoundingClientRect().right <= rr.right + 0.5 };
      }));
      expect(clipped.length).toBeGreaterThan(0);
      expect(clipped.filter(c => !c.btnOk || !c.rowOk || !c.inRow)).toEqual([]);
      expect(clipped.some(c => c.t === 'NDA')).toBe(true);
      // Rail gutter: the first card lines up with the 12px gutter of the tiles above.
      expect((await box(page.locator('[data-rail-card]').first())).x).toBeGreaterThanOrEqual(11.5);
      // Summary preview: key-stat labels are whole, and every section header has a row under it.
      const summary = await page.evaluate(() => {
        const card = document.querySelector('[data-rail-card]')!;
        return {
          labels: [...card.querySelectorAll('[data-stat-label]')].map(el => ({ t: el.textContent, ok: el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1 })),
          orphanHeaders: [...card.querySelectorAll('h3')].filter(h => (h.parentElement?.children.length ?? 0) < 2).map(h => h.textContent),
        };
      });
      expect(summary.labels.length).toBeGreaterThan(0);
      expect(summary.labels.filter(l => !l.ok)).toEqual([]);
      expect(summary.orphanHeaders).toEqual([]);
      const link = page.locator('header a').first();
      if (await link.isVisible()) expect((await box(link)).height).toBeGreaterThanOrEqual(43.5);
      for (const name of ['Choose election', 'Search', 'More']) {
        const b = await box(page.getByRole('button', { name: new RegExp(`^${name}`) }));
        expect(b.height).toBeGreaterThanOrEqual(43.5);
      }
      await page.screenshot({ path: `../.playwright-mcp/t24-${size.width}.png` });
    });

    test('rail: standings preview rows never overlap their bars, and card titles stay put', async ({ page }) => {
      const card = page.getByRole('group', { name: 'Party Standings' });
      await card.scrollIntoViewIfNeeded();
      const rows = card.locator('[data-preview-row]');
      expect(await rows.count()).toBeGreaterThan(0);
      expect(await rows.count()).toBeLessThanOrEqual(4);
      for (let i = 0; i < await rows.count(); i++) {
        const label = await box(rows.nth(i).locator('[data-preview-label]'));
        const bar = await box(rows.nth(i).locator('[data-preview-bar]'));
        expect(overlaps(label, bar)).toBe(false);
      }
      const inner = await card.evaluate(el => el.scrollHeight <= el.clientHeight + 1);
      expect(inner).toBe(true);
      // The watchlist card opens the standings focus, yet the Party Standings card keeps its title.
      await page.getByRole('group', { name: /^Watchlist/ }).getByRole('button', { name: /open/i }).click();
      await expect(page.getByRole('dialog').getByRole('heading', { name: 'Watchlist' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('group', { name: 'Party Standings' })).toHaveCount(1);
    });

    test('the election chip opens the pickers and choosing another election navigates', async ({ page }) => {
      const before = page.url();
      await expect(page.getByRole('button', { name: /^Choose election/ })).toContainText('Bihar');
      await page.getByRole('button', { name: /^Choose election/ }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('radio', { name: /Lok Sabha/ })).toBeVisible();
      await expect(sheet.getByRole('radio', { name: /Vidhan Sabha/ })).toBeVisible();
      await expect(sheet.getByRole('combobox', { name: 'Select State' })).toBeVisible();
      await page.screenshot({ path: `../.playwright-mcp/t24-${size.width}-election.png` });
      await sheet.getByRole('combobox', { name: 'Year' }).click();
      await page.getByRole('option', { name: '2020' }).click();
      await expect(page).not.toHaveURL(before);
      await expect(sheet).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Choose election/ })).toContainText('2020');
    });

    test('a long election label never collides with the icons', async ({ page }) => {
      await page.goto(`/election/${WB_2021}`);
      const chip = page.getByRole('button', { name: /^Choose election/ });
      await expect(chip).toContainText('West Bengal');
      const c = await box(chip);
      const search = await box(page.getByRole('button', { name: 'Search', exact: true }));
      const more = await box(page.getByRole('button', { name: 'More' }));
      expect(c.x + c.width).toBeLessThanOrEqual(search.x + 0.5);
      expect(search.x + search.width).toBeLessThanOrEqual(more.x + 0.5);
      const link = page.locator('header a').first();
      if (await link.isVisible()) { const l = await box(link); expect(l.x + l.width).toBeLessThanOrEqual(c.x + 0.5); }
      await assertNoScroll(page);
      await page.screenshot({ path: `../.playwright-mcp/t24-${size.width}-wb.png` });
    });

    test('the more sheet has the share links and the language picker; search focuses its box', async ({ page }) => {
      await page.getByRole('button', { name: 'More' }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
      await expect(sheet.getByRole('link', { name: 'X', exact: true })).toBeVisible();
      await expect(sheet.getByRole('combobox', { name: 'Language' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.getByRole('dialog').getByRole('searchbox')).toBeFocused();
    });
  });
}

// ---- Task 25: dark / light theme ----
const SHOTS = '../.playwright-mcp';
const bgOf = (page: Page) => page.evaluate(() => getComputedStyle(document.querySelector('.studio-root')!).backgroundColor);
const themeOf = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

/** Sets light once per page session (not on every navigation), so reload persistence is really exercised. */
const forceLight = (page: Page) => page.addInitScript(() => { if (!sessionStorage.getItem('t25-light')) { localStorage.setItem('studio_theme', 'light'); sessionStorage.setItem('t25-light', '1'); } });

/** Every visible tile expand button is a real 44x44 target: box size and hit tests 20px from the centre in all four directions. */
async function expectExpandTargets(page: Page) {
  const vp = page.viewportSize()!;
  let checked = 0;
  for (const b of await page.getByRole('button', { name: /^Expand / }).all()) {
    const bb = (await b.boundingBox())!;
    if (bb.x < 0 || bb.x + bb.width > vp.width || bb.y < 0 || bb.y + bb.height > vp.height) continue; // rail card scrolled out of view
    checked++;
    expect(bb.width, 'expand width').toBeGreaterThanOrEqual(44);
    expect(bb.height, 'expand height').toBeGreaterThanOrEqual(44);
    const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    for (const [dx, dy] of [[0, -20], [0, 20], [-20, 0], [20, 0]]) {
      const hit = await b.evaluate((el, p) => { const t = document.elementFromPoint(p.x, p.y); return !!t && (t === el || el.contains(t)); }, { x: cx + dx, y: cy + dy });
      expect(hit, `expand hit at ${dx},${dy}`).toBe(true);
    }
  }
  expect(checked).toBeGreaterThan(0);
}

test.describe('theme selector', () => {
  test.beforeEach(async ({ page }) => { await page.addInitScript(() => { if (!sessionStorage.getItem('t25')) { localStorage.removeItem('studio_theme'); sessionStorage.setItem('t25', '1'); } }); });

  test('desktop: defaults to dark, the top-bar button switches to light, and light survives a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}`);
    await expect(page.getByText('202').first()).toBeVisible();
    expect(await themeOf(page)).toBe('dark');
    const dark = await bgOf(page);
    expect(dark).toBe('rgb(10, 15, 30)');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/t25-dark-1440.png` });
    const tb = (await page.getByRole('button', { name: 'Switch to light theme' }).boundingBox())!;
    expect(Math.round(tb.width)).toBe(36);
    expect(Math.round(tb.height)).toBe(36);
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    expect(await themeOf(page)).toBe('light');
    expect(await bgOf(page)).toBe('rgb(244, 246, 251)');
    expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe('light');
    await assertNoScroll(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/t25-light-1440.png` });
    await page.reload();
    await expect(page.getByText('202').first()).toBeVisible();
    expect(await themeOf(page)).toBe('light');
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    expect(await themeOf(page)).toBe('dark');
  });

  test('desktop light: summary focus with a chart, dialog and scrim are themed', async ({ page }) => {
    await forceLight(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}?layer=history`);
    await page.getByRole('button', { name: /expand election summary/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('img', { name: 'Margin trend' })).toBeVisible();
    expect(await dialog.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await dialog.getByRole("img", { name: "Margin trend" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/t25-light-focus-1440.png` });
  });

  test('mobile 390: the More sheet has a Theme toggle that switches the dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/election/${BIHAR}`);
    await expect(page.getByText('202').first()).toBeVisible();
    await page.getByRole('button', { name: 'More' }).click();
    const group = page.getByRole('dialog').getByRole('radiogroup', { name: 'Theme' });
    await expect(group.getByRole('radio', { name: 'Dark' })).toBeChecked();
    const box = await group.getByRole('radio', { name: 'Light' }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/t25-light-390-sheet.png` });
    await group.getByRole('radio', { name: 'Light' }).click();
    expect(await themeOf(page)).toBe('light');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await assertNoScroll(page);
    await expectExpandTargets(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/t25-light-390.png` });
    await page.getByRole('button', { name: /Choose election/ }).click();
    await page.getByRole('dialog').getByRole('combobox', { name: 'Year' }).click();
    await expect(page.getByRole('option', { name: '2020' })).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/t25-light-390-year-select.png` });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.reload();
    expect(await themeOf(page)).toBe('light');
  });

  test('desktop light: the map tooltip is themed', async ({ page }) => {
    await forceLight(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}`);
    await expect(page.getByText('202').first()).toBeVisible();
    const tip = page.locator('.studio-root.fixed.pointer-events-none');
    // The map may still be (re)building its paths after data loads, so re-hover until the tooltip appears.
    await expect(async () => {
      const bb = (await page.locator('path.pc').nth(80).boundingBox())!;
      await page.mouse.move(0, 0);
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await expect(tip).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    const [actual, expected] = await tip.evaluate(el => {
      const probe = document.createElement('div');
      probe.style.background = 'color-mix(in oklab, var(--color-page) 95%, transparent)';
      el.parentElement!.appendChild(probe);
      const want = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return [getComputedStyle(el).backgroundColor, want];
    });
    expect(actual).toBe(expected);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim().toLowerCase())).toBe('#f4f6fb');
    await page.screenshot({ path: `${SHOTS}/t25-light-tooltip-1440.png` });
  });

  test('mobile 360: logo mark replaces the hidden title; every map layer tab is reachable and Reserved works; expand buttons are 44px', async ({ page }) => {
    await forceLight(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/election/${BIHAR}`);
    await expect(page.getByText('202').first()).toBeVisible();
    const mark = page.locator('a[data-logo-mark]');
    await expect(mark).toBeVisible();
    const mb = (await mark.boundingBox())!;
    expect(mb.width).toBeGreaterThanOrEqual(44);
    expect(mb.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('link', { name: 'MatdaanPulse' })).toHaveCount(1);
    const tabs = page.getByRole('radiogroup', { name: 'Map layers' });
    const names = await tabs.getByRole('radio').allTextContents();
    expect(names).toContain('Reserved');
    for (const n of names) {
      const r = tabs.getByRole('radio', { name: n, exact: true });
      await r.scrollIntoViewIfNeeded();
      const inside = await r.evaluate(el => { const a = el.getBoundingClientRect(); const c = el.parentElement!.getBoundingClientRect(); return a.left >= c.left - 1 && a.right <= c.right + 1; });
      expect(inside, `${n} fully visible once scrolled`).toBe(true);
    }
    await page.screenshot({ path: `${SHOTS}/t25-light-360.png` });
    await tabs.getByRole('radio', { name: 'Reserved', exact: true }).click();
    await expect(tabs.getByRole('radio', { name: 'Reserved', exact: true })).toBeChecked();
    await assertNoScroll(page);
    await expectExpandTargets(page);
  });

  test('legacy ConstituencyDetail (reached from the seat panel) in dark and light', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}?focus=map&seat=BR_VS_100_BARAULI`);
    await page.getByRole('link', { name: /View full page/ }).click();
    await expect(page).toHaveURL(/constituency\//);
    await page.waitForTimeout(1500);
    expect(await themeOf(page)).toBe('dark');
    await page.screenshot({ path: `${SHOTS}/t25-legacy-dark.png` });
    await page.evaluate(() => localStorage.setItem('studio_theme', 'light'));
    await page.goto(page.url());
    await page.waitForTimeout(1500);
    expect(await themeOf(page)).toBe('light');
    await page.screenshot({ path: `${SHOTS}/t25-legacy-light.png` });
  });

  test('map focus seat list: rank numbers stay inside the panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}?focus=map&seat=BR_VS_100_BARAULI`);
    const aside = page.getByRole('dialog').locator('aside');
    await expect(aside.locator('ol > li').first()).toBeVisible();
    const ab = (await aside.boundingBox())!;
    const lb = (await aside.locator('ol > li').first().boundingBox())!;
    expect(lb.x).toBeGreaterThan(ab.x + 16);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/t25-mapfocus-1440.png` });
  });
});

test.describe('scrollable side card and restored charts', () => {
  const SHOTS26 = '../.playwright-mcp';
  const region = (page: Page, name: string | RegExp) => page.getByRole('region', { name });
  const pageScroll = (page: Page) => page.evaluate(() => document.scrollingElement!.scrollTop);

  for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    test(`side card tabs scroll inside the card at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/election/${BIHAR}`);
      const summary = region(page, /^Summary/);
      await expect(summary).toBeVisible();
      await expect(page.getByText('Avg Margin')).toBeVisible();
      const m = await summary.evaluate(el => ({ sh: el.scrollHeight, ch: el.clientHeight }));
      expect(m.sh).toBeGreaterThan(m.ch);
      await expect(page.getByText(/\+\d+ more/)).toHaveCount(0);
      // scrolling the region moves it, not the page
      await summary.hover();
      await page.mouse.wheel(0, 420);
      await expect.poll(() => summary.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      expect(await pageScroll(page)).toBe(0);
      await assertNoScroll(page);
      if (size.width === 1440) await page.screenshot({ path: `${SHOTS26}/t26-card-scrolled-1440.png` });
      // scrolled to the very end, the last section's header is reachable and the last row is fully inside
      await summary.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const end = await summary.evaluate(el => {
        const h = [...el.querySelectorAll('h3')].pop()!.getBoundingClientRect();
        const c = el.getBoundingClientRect();
        const last = [...el.querySelectorAll('button, div')].filter(x => x.children.length && x.getBoundingClientRect().height > 0).pop()!.getBoundingClientRect();
        return { maxed: Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) <= 1, header: h.top >= c.top - 1 && h.bottom <= c.bottom + 1, lastRow: last.bottom <= c.bottom + 1 };
      });
      expect(end).toEqual({ maxed: true, header: true, lastRow: true });
      // switching layer resets the scroll position
      expect(await summary.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      await page.getByRole('radio', { name: 'Swing', exact: true }).click();
      await expect(page.getByRole('radio', { name: /^Summary/ })).toBeChecked();
      await expect(page.getByRole('heading', { name: /Flipped seats/ })).toBeVisible();
      await expect.poll(() => region(page, /^Summary/).evaluate(el => el.scrollTop)).toBe(0);
      await assertNoScroll(page);

      // Parties: every party is a row
      await page.getByRole('radio', { name: 'Parties' }).click();
      const parties = region(page, 'Parties');
      await expect(parties).toBeVisible();
      await expect(page.getByText(/\+\d+ more part/)).toHaveCount(0);
      const tileRows = await parties.getByRole('button', { name: /^\S+ .+ \d+$/ }).count();
      await page.getByRole('button', { name: /expand party standings/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const withSeats = await dialog.getByRole('button', { name: /^\S+ .+ [1-9]\d*$/ }).count();
      expect(tileRows).toBe(withSeats);
      await page.keyboard.press('Escape');

      // Watchlist: the add picker stays visible without scrolling
      await page.getByRole('radio', { name: /Watchlist/ }).click();
      const picker = page.getByRole('combobox', { name: /Add a seat/ });
      await expect(picker).toBeVisible();
      const pb = (await picker.boundingBox())!;
      const tile = (await page.getByRole('region', { name: /Watchlist/ }).boundingBox())!;
      expect(pb.y).toBeGreaterThanOrEqual(tile.y + tile.height - 1);
      expect(pb.y + pb.height).toBeLessThanOrEqual(size.height);
      await assertNoScroll(page);
    });
  }

  test('reserved focus shows the two grouped charts (dark and light)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}?layer=demographics`);
    await page.getByRole('button', { name: /expand election summary/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('img', { name: 'Wins by category' })).toBeVisible();
    await expect(dialog.getByRole('img', { name: 'Average margin by category' })).toBeVisible();
    await expect(dialog.locator('svg[role="img"]')).toHaveCount(2);
    await dialog.getByRole('img', { name: 'Wins by category' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS26}/t26-reserved-focus-1440.png` });
    await page.keyboard.press('Escape');
    await page.evaluate(() => localStorage.setItem('studio_theme', 'light'));
    await page.reload();
    await page.getByRole('button', { name: /expand election summary/i }).click();
    await expect(page.getByRole('dialog').getByRole('img', { name: 'Wins by category' })).toBeVisible();
    expect(await themeOf(page)).toBe('light');
    await page.getByRole('dialog').getByRole('img', { name: 'Wins by category' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS26}/t26-reserved-focus-1440-light.png` });
    await page.evaluate(() => localStorage.removeItem('studio_theme'));
  });

  for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`overview focus shows vote share vs seats and the Alliances / Parties toggle switches it at ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`/election/${BIHAR}`);
    await page.getByRole('button', { name: /expand election summary/i }).click();
    const dialog = page.getByRole('dialog');
    const chart = dialog.getByRole('img', { name: /^Vote share vs seats/ });
    await chart.scrollIntoViewIfNeeded();
    await expect(chart).toBeVisible();
    const toggle = dialog.getByRole('radiogroup', { name: 'Vote share vs seats' });
    await expect(toggle.getByRole('radio', { name: 'Alliances' })).toBeChecked();
    const before = await dialog.locator('table.sr-only tbody tr').evaluateAll(rows => rows.map(r => r.querySelector('th')!.textContent).join('|'));
    expect(await chart.locator('[data-annotation]').count()).toBeGreaterThan(1);
    await page.waitForTimeout(300);
    if (size.width === 1440) await page.screenshot({ path: `${SHOTS26}/t26-overview-focus-1440.png` });
    await toggle.getByRole('radio', { name: 'Parties' }).click();
    await expect(toggle.getByRole('radio', { name: 'Parties' })).toBeChecked();
    // the chart and section title follow the toggle
    const parties = dialog.getByRole('img', { name: 'Vote share vs seats · Parties' });
    await expect(parties).toBeVisible();
    const after = await dialog.locator('table.sr-only tbody tr').evaluateAll(rows => rows.map(r => r.querySelector('th')!.textContent).join('|'));
    expect(after).not.toBe(before);
    // at most 10 parties, labelled by short id, and no two axis labels overlap
    const labels = await parties.locator('text').evaluateAll(ts => ts.filter(t => t.querySelector(':scope > title')).map(t => { const r = t.getBoundingClientRect(); return { t: [...t.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(''), l: r.left, r: r.right }; }));
    expect(labels.length).toBeLessThanOrEqual(10);
    expect(labels.length).toBeGreaterThan(3);
    labels.forEach(l => expect(l.t!.length).toBeLessThanOrEqual(12));
    const sorted = [...labels].sort((a, b) => a.l - b.l);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].l, `${sorted[i - 1].t} / ${sorted[i].t}`).toBeGreaterThanOrEqual(sorted[i - 1].r - 0.5);
    await page.waitForTimeout(300);
    if (size.width === 1440) await page.screenshot({ path: `${SHOTS26}/t26-overview-focus-parties-1440.png` });
  });
  }
});

// ---- Task 27: precise, stable map highlighting ----
test.describe('task 27: map highlight from the summary', () => {
  const SHOTS27 = '../.playwright-mcp';
  const hlCount = (page: Page) => page.locator('path.pc[data-highlighted="true"]').count();
  const section = (page: Page, title: string) => page.locator('h3', { hasText: title }).locator('xpath=..');
  const dimmed = (page: Page) => page.evaluate(() => [...document.querySelectorAll('path.pc')].filter(p => !p.hasAttribute('data-highlighted') && (p as SVGPathElement).style.fillOpacity === '0.12').length);

  test('hovering a closest-battles row highlights exactly that seat; the rest is dimmed; the outline survives in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}`);
    const rows = section(page, 'Closest battles').getByRole('button');
    await expect(rows.first()).toBeVisible();
    await rows.first().hover();
    await expect.poll(() => hlCount(page)).toBe(1);
    const total = await page.locator('path.pc').count();
    expect(await dimmed(page)).toBe(total - 1);
    await expect(page.locator('path.pc[data-highlighted="true"]')).toHaveCSS('fill-opacity', '1');
    await expect(page.locator('g.pc-highlight path')).toHaveCount(1);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS27}/t27-closest-hover-1440.png` });
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await rows.first().hover();
    await expect.poll(() => hlCount(page)).toBe(1);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS27}/t27-closest-hover-1440-light.png` });
  });

  test('hovering the first margin bucket highlights as many seats as its value', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}`);
    const first = section(page, 'Margin distribution').getByRole('button').first();
    await expect(first).toBeVisible();
    const value = Number((await first.innerText()).match(/(\d+)\s*$/)![1]);
    expect(value).toBeGreaterThan(0);
    await first.hover();
    await expect.poll(() => hlCount(page)).toBe(value);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS27}/t27-bucket-hover-1440.png` });
  });

  test('moving straight from one row to the next never drops the highlight in between', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}`);
    const rows = section(page, 'Closest battles').getByRole('button');
    await expect(rows.nth(1)).toBeVisible();
    const litPath = () => page.locator('path.pc[data-highlighted="true"]').first().getAttribute('d');
    // the second row's seat, recorded on its own
    await rows.nth(1).hover();
    await expect.poll(() => hlCount(page)).toBe(1);
    const second = await litPath();
    await page.mouse.move(0, 0);
    await expect.poll(() => hlCount(page)).toBe(0);
    await rows.first().hover();
    await expect.poll(() => hlCount(page)).toBe(1);
    const first = await litPath();
    expect(first).not.toBe(second);
    await page.evaluate(() => {
      const w = window as unknown as { __hl: number[]; __iv: number };
      w.__hl = [];
      w.__iv = window.setInterval(() => w.__hl.push(document.querySelectorAll('path.pc[data-highlighted="true"]').length), 4);
    });
    const a = (await rows.first().boundingBox())!;
    const b = (await rows.nth(1).boundingBox())!;
    await page.mouse.move(a.x + 20, a.y + a.height / 2);
    await page.mouse.move(b.x + 20, b.y + b.height / 2, { steps: 40 });
    await page.waitForTimeout(150);
    const samples = await page.evaluate(() => { const w = window as unknown as { __hl: number[]; __iv: number }; clearInterval(w.__iv); return w.__hl; });
    expect(samples.length).toBeGreaterThan(10);
    expect(Math.min(...samples)).toBe(1);
    // and it ends on the second row's seat
    await expect.poll(() => hlCount(page)).toBe(1);
    expect(await litPath()).toBe(second);
  });

  test('a locked row is previewed over by hovering another, and returns when the hover ends', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}`);
    const buckets = section(page, 'Margin distribution').getByRole('button');
    await expect(buckets.nth(1)).toBeVisible();
    const v0 = Number((await buckets.nth(0).innerText()).match(/(\d+)\s*$/)![1]);
    const v1 = Number((await buckets.nth(1).innerText()).match(/(\d+)\s*$/)![1]);
    expect(v0).not.toBe(v1);
    await buckets.nth(0).click();
    await page.mouse.move(0, 0);
    await expect.poll(() => hlCount(page)).toBe(v0);
    await buckets.nth(1).hover();
    await expect.poll(() => hlCount(page)).toBe(v1);
    await page.mouse.move(0, 0);
    await expect.poll(() => hlCount(page)).toBe(v0);
  });

  test('battle layer: the hovered close seat is drawn at full opacity', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${BIHAR}?layer=battle`);
    const rows = section(page, 'Closest contests').getByRole('button');
    await expect(rows.first()).toBeVisible();
    await expect.poll(() => page.locator('path.pc').evaluateAll(ps => ps.some(p => (p as SVGPathElement).style.fillOpacity === '0.25'))).toBe(true);
    await rows.first().hover();
    await expect.poll(() => hlCount(page)).toBe(1);
    await expect(page.locator('path.pc[data-highlighted="true"]')).toHaveCSS('fill-opacity', '1');
  });

  test('large highlights (LS: NDA bloc) are lit without outlines; a single seat keeps its outline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/election/${LS_ID}`);
    await expect(page.locator('path.pc').first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^(NDA|National Democratic Alliance) \d+$/ }).first().hover();
    await expect.poll(() => hlCount(page)).toBeGreaterThan(40);
    await expect(page.locator('g.pc-highlight path')).toHaveCount(0);
    await expect(page.locator('path.pc[data-highlighted="true"]').first()).toHaveCSS('fill-opacity', '1');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS27}/t27-ls-nda-1440.png` });
    await page.mouse.move(0, 0);
    await expect.poll(() => hlCount(page)).toBe(0);
    await section(page, 'Closest battles').getByRole('button').first().hover();
    await expect.poll(() => hlCount(page)).toBe(1);
    await expect(page.locator('g.pc-highlight path')).toHaveCount(1);
  });
});

// ── CDN-ready live: polling a versioned snapshot (DEPLOYMENT §2.2) ─────────────
// Uses Kerala 2021, which no other test asserts on. The election is set to Live and a
// seat's result is overridden through the admin API; both are restored afterwards.
const KERALA_2021 = 'a7b8c9d0-e1f2-3456-0123-678901232021';
const API = 'http://localhost:3082/api/v1';

/** E2E_ADMIN_TOKEN, else one login with ADMIN_EMAIL/ADMIN_PASSWORD (env or the repo's .env). */
async function adminToken(request: import('@playwright/test').APIRequestContext): Promise<string | null> {
  if (process.env.E2E_ADMIN_TOKEN) return process.env.E2E_ADMIN_TOKEN;
  const env: Record<string, string> = {};
  for (const file of ['../.env', '../backend/.env']) {
    try {
      for (const line of readFileSync(new URL(file, `file://${process.cwd()}/`), 'utf8').split('\n')) {
        const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* file absent */ }
  }
  const email = process.env.ADMIN_EMAIL ?? env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD ?? env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  const res = await request.post(`${API}/auth/login`, { data: { email, password } });
  if (!res.ok()) return null;
  return ((await res.json()) as { data: { access_token: string } }).data.access_token;
}

test('live: an admin override reaches an open dashboard within 20 s without reload', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await adminToken(request);
  test.skip(!token, 'no admin credentials (E2E_ADMIN_TOKEN or ADMIN_EMAIL/ADMIN_PASSWORD)');
  const auth = { Authorization: `Bearer ${token}` };

  type Cand = { result_id: string; party_id: string; votes: number; status: string; margin: number };
  const live = await request.get(`${API}/admin/elections/${KERALA_2021}/live-results`, { headers: auth });
  const seats = ((await live.json()) as { data: { const_id: string; candidates: Cand[] }[] }).data;
  const seat = seats.find(s => s.candidates.length >= 2 && s.candidates[0].status === 'WON' && s.candidates[1].party_id !== s.candidates[0].party_id)!;
  const [winner, runner] = seat.candidates;
  const override = (items: Cand[]) => request.post(`${API}/admin/results/override-bulk`, {
    headers: auth,
    data: { election_id: KERALA_2021, overrides: items.map(c => ({ result_id: c.result_id, votes: c.votes, status: c.status, margin: c.margin })) },
  });

  expect((await request.patch(`${API}/admin/elections/${KERALA_2021}`, { headers: auth, data: { status: 'Live' } })).ok()).toBe(true);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    const snapshots: string[] = [];
    page.on('request', r => { if (/\/results\?v=\d+/.test(r.url())) snapshots.push(r.url()); });
    await page.goto(`/election/${KERALA_2021}`);
    await expect(page.getByText('Waiting for updates')).toBeVisible();
    await expect.poll(() => snapshots.length).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    const initial = snapshots.length; // 1 (2 under React StrictMode in dev)

    const res = await override([
      { ...runner, votes: winner.votes + 1000, status: 'WON', margin: 1000 },
      { ...winner, status: 'LOST', margin: 0 },
    ]);
    expect(res.ok()).toBe(true);

    // Ticker is derived from the snapshot diff: the runner-up's party now wins the seat.
    await expect(page.getByText(`${runner.party_id} wins`).first()).toBeVisible({ timeout: 20_000 });
    expect(snapshots.length).toBeGreaterThan(initial);
  } finally {
    await override([winner, runner]);
    await request.patch(`${API}/admin/elections/${KERALA_2021}`, { headers: auth, data: { status: 'Finalized' } });
  }
});
