import { defineConfig } from '@playwright/test';
/** Live counting-day e2e (docs/superpowers/specs/2026-10-08-live-e2e-layer1-design.md): `npm run e2e:live`. */
export default defineConfig({
  testDir: 'e2e/live',
  workers: 1,
  fullyParallel: false,
  timeout: 15 * 60_000,
  globalSetup: './e2e/live/global-setup.ts',
  globalTeardown: './e2e/live/global-teardown.ts',
  use: { baseURL: 'http://localhost:3080', colorScheme: 'dark', screenshot: 'only-on-failure' },
  reporter: 'list',
});
