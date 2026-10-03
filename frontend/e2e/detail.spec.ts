import { test, expect } from '@playwright/test';

const BIHAR = 'c3d4e5f6-a7b8-9012-cdef-234567890abc';

test('clicking a seat on the map opens the seat dialog, not the map focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}`);
  await page.locator('path.pc').nth(80).click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/seat=/);
  await expect(page).not.toHaveURL(/focus=map/);
  await expect(page.getByRole('dialog').getByRole('link', { name: /Full constituency page/ })).toBeVisible();
});

test('a party opens the party dialog from standings and the URL carries ?party=', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}`);
  await page.getByRole('radio', { name: 'Parties' }).click();
  await page.getByRole('button', { name: /^Party details:/ }).first().click();
  await expect(page).toHaveURL(/party=/);
  await expect(page.getByRole('dialog')).toContainText('This election');
});

test('a party opened from the seat dialog stacks over it and closing it returns to the seat', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}?seat=BR_VS_100_BARAULI`);
  const seat = page.getByRole('dialog');
  await expect(seat.getByRole('link', { name: /Full constituency page/ })).toBeVisible();
  await seat.locator('table').getByRole('button').first().click();
  await expect(page).toHaveURL(/party=/);
  const party = page.getByRole('dialog').filter({ hasText: 'This election' });
  await expect(party).toBeVisible();
  await party.getByRole('button', { name: 'Close' }).click();
  await expect(page).not.toHaveURL(/party=/);
  await expect(page).toHaveURL(/seat=BR_VS_100_BARAULI/);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('dialog').getByRole('link', { name: /Full constituency page/ })).toBeVisible();
});

test('constituency page renders the heading, party marks and all candidates', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}/constituency/BR_VS_100_BARAULI`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const all = page.getByRole('region', { name: 'All candidates' });
  await expect(all.getByRole('heading', { name: 'All candidates' })).toBeVisible();
  // A party mark is the logo / ECI symbol image or the colour dot (both role="img").
  await expect(all.getByRole('img').first()).toBeAttached();
});

test('person page renders the profile and the contest timeline', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/election/${BIHAR}?seat=BR_VS_100_BARAULI`);
  await page.getByRole('dialog').locator('table').getByRole('link').first().click();
  await expect(page).toHaveURL(/person\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Contest timeline')).toBeVisible();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the seat dialog is a bottom sheet', async ({ page }) => {
    await page.goto(`/election/${BIHAR}?seat=BR_VS_100_BARAULI`);
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    // Wait for the sheet's slide-in to settle at the bottom edge.
    await expect.poll(async () => { const b = await sheet.boundingBox(); return b ? b.y + b.height : 0; }).toBeGreaterThan(830);
  });
});
