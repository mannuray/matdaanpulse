// One-off: renders scripts/og-default.html to public/og/default.png (1200×630). Run: node scripts/render-og.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(here, '../public/og'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(resolve(here, 'og-default.html')).href);
await page.screenshot({ path: resolve(here, '../public/og/default.png') });
await browser.close();
