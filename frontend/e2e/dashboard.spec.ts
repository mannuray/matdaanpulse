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
  await expect(dialog.getByRole('img', { name: 'Margin distribution' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // The chosen layer stays after closing.
  await expect(page.getByRole('radio', { name: 'Summary · Battle' })).toBeChecked();
  await assertNoScroll(page);
});
