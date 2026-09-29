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
  await page.getByRole('button', { name: /expand party standings/i }).click();
  await expect(page).toHaveURL(/focus=standings/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/focus=/);
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
