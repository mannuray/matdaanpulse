import { test, expect, type Page } from '@playwright/test';

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

test('summary focus opens from the Summary tab footer with charts, switches layers and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}?layer=history`);
  await expect(page.getByRole('radio', { name: 'Summary · History' })).toBeChecked();
  await page.getByRole('button', { name: /more (rows|sections?|row)/ }).click();
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
      expect(map.height).toBeGreaterThan(120);
      await assertNoScroll(page);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('[data-bloc-label]')].map(el => ({ t: el.textContent, ok: el.scrollWidth <= el.clientWidth })));
      expect(clipped.length).toBeGreaterThan(0);
      expect(clipped.filter(c => !c.ok)).toEqual([]);
      expect(clipped.some(c => c.t === 'NDA')).toBe(true);
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
      const cardBox = await box(card);
      const inner = await card.evaluate(el => el.scrollHeight <= el.clientHeight + 1);
      expect(inner).toBe(true);
      expect((await box(card.locator('[data-preview-row]').last())).y + 18).toBeLessThanOrEqual(cardBox.y + cardBox.height);
      // The watchlist card opens the standings focus, yet the Party Standings card keeps its title.
      await page.locator('[data-rail-card]').nth(2).getByRole('button', { name: /open/i }).click();
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
