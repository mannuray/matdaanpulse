import { defineConfig } from '@playwright/test';
// The live counting-day suite (e2e/live) has its own config: playwright.live.config.ts.
export default defineConfig({ testDir: 'e2e', testIgnore: 'live/**', use: { baseURL: 'http://localhost:3080' }, reporter: 'list' });
