import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

/** The dashboard (and the landing redirect) stay in the main bundle; every other page is its own chunk. */
describe('route code splitting (App.tsx)', () => {
  it.each(['ConstituencyDetail', 'PersonDetail', 'PartyDetail', 'About'])('%s is loaded lazily', (page) => {
    expect(app).toMatch(new RegExp(`lazy\\(\\(\\) => import\\('\\./pages/${page}'\\)\\)`));
    expect(app).not.toMatch(new RegExp(`^import \\w+ from '\\./pages/${page}';`, 'm'));
  });

  it.each(['Home', 'ElectionView'])('%s stays eager', (page) => {
    expect(app).toMatch(new RegExp(`^import ${page} from '\\./pages/${page}';`, 'm'));
  });

  it('lazy routes render inside Suspense', () => {
    expect(app).toMatch(/<Suspense\b/);
  });
});
