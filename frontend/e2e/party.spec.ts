import { test, expect } from '@playwright/test';

// Party page (docs/superpowers/specs/2026-10-08-party-page-design.md); screenshots in e2e/artifacts/party/.
test('party national view: states table and a link to the state view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/party/BJP');
  await expect(page.getByRole('heading', { level: 1, name: /Bharatiya Janata Party/i })).toBeVisible();
  await expect(page.getByText(/at each state's latest election/)).toBeVisible();
  await expect(page.locator('table').getByRole('link', { name: 'Jharkhand' })).toBeVisible();
  await page.screenshot({ path: 'e2e/artifacts/party/national-desktop.png' });
  await page.locator('table').getByRole('link', { name: 'Jharkhand' }).click();
  await expect(page).toHaveURL(/\/party\/BJP\?state=JH/);
});

test('party state view: record, map, MLAs search, jump links', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/party/BJP?state=JH');
  await expect(page.locator('#pty-record')).toBeVisible();
  await expect(page.locator('#pty-map path[data-seat]').first()).toBeAttached({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'MLAs' })).toHaveAttribute('href', '#pty-mlas');
  const search = page.getByRole('searchbox');
  const before = await page.locator('#pty-mlas li').count();
  expect(before).toBeGreaterThan(0);
  await search.fill('zzzz-no-match');
  await expect(page.locator('#pty-mlas li')).toHaveCount(0);
  await search.fill('');
  await expect(page.locator('#pty-mlas li')).toHaveCount(before);
  await page.screenshot({ path: 'e2e/artifacts/party/state-desktop.png' });
});

test('a one-state party opens on its state view', async ({ page }) => {
  await page.goto('/party/SKM');   // Sikkim Krantikari Morcha: Sikkim only
  await expect(page).toHaveURL(/\/party\/SKM\?state=SK/);
  await expect(page.locator('#pty-record')).toBeVisible();
});

test('unknown party: not found', async ({ page }) => {
  await page.goto('/party/NOPE-PARTY');
  await expect(page.getByText(/Party not found/)).toBeVisible();
});

test('phone: national and state views', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/party/BJP');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: 'e2e/artifacts/party/national-mobile.png' });
  await page.goto('/party/BJP?state=JH');
  await expect(page.locator('#pty-record')).toBeVisible();
  await page.screenshot({ path: 'e2e/artifacts/party/state-mobile.png' });
});
