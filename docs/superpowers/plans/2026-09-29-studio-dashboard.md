# Studio Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public election dashboard with a non-scrolling, dark "election-night studio" tile wall (desktop) and a map-first card-rail layout (mobile), built MVVM with Tailwind v4 + Radix, reaching feature parity with tag `fe-baseline-v1`.

**Architecture:** Pure TypeScript **Model** (`src/model/`: api, types, pure `derive/*` functions) → hook **ViewModels** (`src/viewmodels/`: data hooks, one VM hook per tile, a URL-synced `DashboardStore`) → presentational **Views** (`src/views/`: Tailwind + Radix components, D3 `MapCanvas`), composed only in `src/pages/StudioDashboard.tsx`. One-way imports are enforced by ESLint.

**Tech Stack:** React 18, TypeScript 5, Vite 5, D3 7, i18next, Tailwind CSS v4 (`@tailwindcss/vite`, preflight off), Radix UI (dialog, toggle-group, select), `clsx` + `tailwind-merge`, `@fontsource/*`, Vitest 2 + `@testing-library/react` + jsdom, Playwright (browser checks), ESLint 9 flat config.

**Spec:** `docs/superpowers/specs/2026-09-29-studio-dashboard-design.md` (read it before starting; section numbers below refer to it).

## Global Constraints

- Work on branch `feat/fe-redesign`. Compare behaviour against the baseline served from the worktree `../election-tracker-baseline` on http://localhost:3086 (tag `fe-baseline-v1`). The redesign runs on http://localhost:3080, backend on :3082.
- All commands run from `frontend/` unless stated.
- **No page scroll** on the dashboard at 1440×900, 1280×720 and 390×844; tiles never show scrollbars in the grid view. Only the focus overlay may scroll.
- **No accordions/collapsibles** for scoreboard, standings, leaders, stats.
- **Dark only** on the dashboard. Tokens (exact values): page `#0A0F1E`, tile `#111933`, border `#1E2A4A`, text `#F4F6FB`, muted `#8C96B0`, accent `#8B7CFF`, live `#FF3B3B`, radius 16px.
- Fonts: Barlow Condensed (numbers/headlines), Inter (body), Noto Sans Devanagari / Tamil fallbacks, self-hosted via `@fontsource`.
- **Real data only** — no invented numbers; turnout/gender are not shown.
- Tailwind **preflight stays off** (legacy pages still use `src/theme/index.css`).
- MVVM import rules (§10.1): `views/` must not import `model/api`, `model/derive`, `model/live`, `viewmodels/data`; `model/` must not import `viewmodels/`, `views/`, `pages/`; `viewmodels/` must not import `views/`, `pages/`. Enforced by `npm run lint`.
- Every user-visible string goes through `t()` with keys in **all four** locales (`en`, `hi`, `ta`, `mr`); `src/__tests__/i18n.test.ts` must stay green.
- Hex cartogram is phase 2: the Map|Hex toggle renders only when `manifest.geo.hex_url` is set (never, today).
- Each task ends green on: `npx tsc --noEmit`, `npm test`, `npm run lint` (from Task 1 on), `npm run build`.
- Commit after every task with a message ending in:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **Election with no alliances in its manifest** (several VS elections) — the scoreboard must fall back to the top two parties, not render empty blocs. → test in Task 4.
2. **Upcoming / just-started Live election with zero results** (every seat PENDING) — stats show "—" instead of crashing on `null`, standings show zero rows gracefully, map fills are all pending. → tests in Tasks 5, 6, 9.
3. **Short windows (1280×720, and heights down to ~650px)** — fit math must still show at least one row plus a correct "+N more · M seats" footer, and never let a tile overflow. → tests in Tasks 3 and 5; browser check in Task 19.
4. **Hand-edited or stale URLs** (`?layer=bogus&focus=nope&seat=NOT_A_SEAT`, or `?layer=swing` on an election with no previous election) — invalid params are ignored, falling back to defaults. → tests in Task 10.
5. **Lok Sabha 2024** (543 seats, bare ids like `AGRA`, States layer, same-named seats in two states) — stats, states insight and map matching must work without state prefixes. → tests in Tasks 6, 8 and 9 use LS rows.

---

## File Structure

```
frontend/src/
  model/                      # MODEL — no React
    api/                      # moved from services/ (HTTP, SSE client, caches)
    types/index.ts            # moved from types/index.ts
    types/dashboard.ts        # NEW: PartySeats, SeatResult, LayerId, Highlight
    geo/                      # moved: regionMatching, normalizeConstId, geoHelpers; NEW featureMatch.ts
    live/                     # moved: liveUpdates; NEW ticker.ts
    derive/                   # NEW pure functions (+ moved intelligence.ts)
      fit.ts scoreboard.ts standings.ts stats.ts leaders.ts layerInsights.ts mapFill.ts
      __tests__/*.test.ts
  viewmodels/                 # VIEWMODEL — hooks, no JSX
    data/                     # moved from hooks/ (useDashboardData, useAnalysis, …)
    store/dashboardStore.ts   # NEW reducer + URL (de)serialisation
    store/DashboardStoreProvider.tsx
    sources/useDashboardSources.ts  sources/DashboardSourcesProvider.tsx
    tiles/useTopBarVM.ts useScoreboardVM.ts useStandingsVM.ts useLayerInsightVM.ts
          useLeadersVM.ts useStatsVM.ts useMapVM.ts useSeatPanelVM.ts
    __tests__/*.test.ts(x)
  views/                      # VIEW — presentational
    ui/cn.ts ui/FocusDialog.tsx ui/PillToggle.tsx ui/PickerSelect.tsx
    hooks/useElementHeight.ts hooks/useMediaQuery.ts
    dashboard/Tile.tsx FocusOverlay.tsx DashboardGrid.tsx TopBar.tsx SearchBox.tsx ShareMenu.tsx
              ScoreboardTile.tsx StandingsTile.tsx LayerInsightStrip.tsx LeadersStrip.tsx
              StatsStrip.tsx MobileCardRail.tsx
    map/MapCanvas.tsx MapTile.tsx SeatPanel.tsx useMapRendering.ts (moved)
  pages/StudioDashboard.tsx   # COMPOSITION
  theme/studio.css            # tokens + Tailwind layers
frontend/e2e/dashboard.spec.ts  frontend/playwright.config.ts
database/migrations/013_party_colors_dark.sql
```

Old paths (`services/*`, `types/index.ts`, `utils/*`, `hooks/*`, `components/organisms/useMapRendering.ts`) keep **one-line re-export shims** so legacy pages compile unchanged.

---

### Task 1: Toolchain — Tailwind v4, Radix, fonts, tokens, ESLint boundaries

**Files:**
- Modify: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/main.tsx`
- Create: `frontend/src/theme/studio.css`, `frontend/eslint.config.js`, `frontend/src/views/ui/cn.ts`
- Test: `frontend/src/views/ui/__tests__/cn.test.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` from `src/views/ui/cn.ts`; Tailwind theme tokens usable as classes: `bg-page`, `bg-tile`, `border-line`, `text-ink`, `text-muted`, `text-accent`, `bg-accent`, `text-live`, `font-display`, `font-body`, `rounded-tile`; CSS vars `--color-map-pending`, `--color-map-swing`, `--color-map-threeway`, `--color-map-bg`, `--color-map-stroke`.

- [ ] **Step 1: Install dependencies**

```bash
npm install tailwindcss@^4 @tailwindcss/vite@^4 @radix-ui/react-dialog @radix-ui/react-toggle-group @radix-ui/react-select clsx tailwind-merge \
  @fontsource/barlow-condensed @fontsource-variable/inter @fontsource/noto-sans-devanagari @fontsource/noto-sans-tamil
npm install -D eslint@^9 @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-import eslint-import-resolver-typescript \
  @testing-library/react@^16 @testing-library/dom jsdom @playwright/test
```

- [ ] **Step 2: Write the failing test for `cn`**

`src/views/ui/__tests__/cn.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('joins truthy classes and lets later Tailwind classes win', () => {
    expect(cn('px-2 text-muted', false && 'hidden', 'px-4')).toBe('text-muted px-4');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/views/ui/__tests__/cn.test.ts`
Expected: FAIL — `Failed to resolve import "../cn"`.

- [ ] **Step 4: Implement `cn`, Tailwind wiring and tokens**

`src/views/ui/cn.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names; later Tailwind utilities override earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3080 },
});
```

`src/theme/studio.css` (preflight deliberately NOT imported — see spec §7):
```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

@theme {
  --color-page: #0A0F1E;
  --color-tile: #111933;
  --color-tile-raised: #16203F;
  --color-line: #1E2A4A;
  --color-ink: #F4F6FB;
  --color-muted: #8C96B0;
  --color-accent: #8B7CFF;
  --color-live: #FF3B3B;
  --color-map-bg: #0D1428;
  --color-map-stroke: #0A0F1E;
  --color-map-pending: #2A3452;
  --color-map-swing: #E8C547;
  --color-map-threeway: #F59E0B;
  --radius-tile: 16px;
  --font-display: "Barlow Condensed", "Noto Sans Devanagari", "Noto Sans Tamil", sans-serif;
  --font-body: "Inter Variable", "Noto Sans Devanagari", "Noto Sans Tamil", system-ui, sans-serif;
}

/* Scoped base styles for the studio dashboard only (no global reset). */
.studio-root {
  background: var(--color-page);
  color: var(--color-ink);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}
.studio-root *, .studio-root *::before, .studio-root *::after { box-sizing: border-box; }
.studio-root button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.studio-root .tabular { font-variant-numeric: tabular-nums; }
@keyframes studio-pulse { 0% { box-shadow: 0 0 0 0 rgb(139 124 255 / .6); } 100% { box-shadow: 0 0 0 10px rgb(139 124 255 / 0); } }
.studio-pulse { animation: studio-pulse 900ms ease-out 1; }
@keyframes studio-zoom { from { opacity: 0; transform: translate(-50%, -50%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
.studio-focus[data-state="open"] { animation: studio-zoom 200ms ease-out; }
@media (prefers-reduced-motion: reduce) { .studio-pulse, .studio-focus[data-state="open"] { animation: none; } }
```

`src/main.tsx` — add at the top, before the existing `index.css` import:
```ts
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource-variable/inter';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-tamil/400.css';
import './theme/studio.css';
```

`eslint.config.js`:
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/components/**', 'src/hooks/**', 'src/services/**', 'src/utils/**', 'src/types/**', 'src/pages/Dashboard.tsx', 'src/pages/ConstituencyDetail.tsx', 'src/pages/PersonDetail.tsx', 'src/theme/ThemeProvider.tsx', 'e2e/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, import: importPlugin },
    settings: { 'import/resolver': { typescript: true, node: { extensions: ['.ts', '.tsx'] } } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import/no-restricted-paths': ['error', {
        zones: [
          { target: './src/model', from: ['./src/viewmodels', './src/views', './src/pages'], message: 'Model must not depend on ViewModels/Views.' },
          { target: './src/viewmodels', from: ['./src/views', './src/pages'], message: 'ViewModels must not depend on Views.' },
          { target: './src/views', from: ['./src/model/api', './src/model/derive', './src/model/live', './src/viewmodels/data', './src/pages'], message: 'Views only consume ViewModel output (types from model/types are fine).' },
        ],
      }],
    },
  },
);
```

`package.json` scripts — add:
```json
"lint": "eslint src",
"e2e": "playwright test"
```

- [ ] **Step 5: Run the checks**

Run: `npx vitest run src/views/ui/__tests__/cn.test.ts && npx tsc --noEmit && npm run lint && npm run build`
Expected: test PASS; tsc, lint and build succeed. Open http://localhost:3080/election/c3d4e5f6-a7b8-9012-cdef-234567890abc and confirm the legacy dashboard still looks exactly like :3086 (preflight is off, so nothing restyles).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts eslint.config.js src/main.tsx src/theme/studio.css src/views/ui
git commit -m "Add Tailwind v4, Radix, fonts, studio tokens and ESLint MVVM boundaries"
```

---

### Task 2: MVVM folders — move model and data-hook code behind re-export shims

**Files:**
- Move (git mv): `src/services/*` → `src/model/api/`; `src/types/index.ts` → `src/model/types/index.ts`; `src/utils/{regionMatching,normalizeConstId,geoHelpers}.ts` → `src/model/geo/`; `src/utils/liveUpdates.ts` → `src/model/live/liveUpdates.ts`; `src/services/intelligence.service.ts` → `src/model/derive/intelligence.ts`; `src/hooks/*` → `src/viewmodels/data/`; `src/components/organisms/useMapRendering.ts` → `src/views/map/useMapRendering.ts`
- Create: shim files at every old path; `src/model/types/dashboard.ts`
- Modify: `src/viewmodels/data/useDashboardData.ts` (expose `voteShare`, use `PartySeats`/`SeatResult`)
- Test: existing suite (`npm test`) + `src/model/types/__tests__/dashboard.test.ts`

**Interfaces:**
- Produces (`src/model/types/dashboard.ts`):
```ts
export type LayerId = 'overview' | 'battle' | 'swing' | 'history' | 'demographics' | 'insights' | 'states';
export interface PartySeats { id: string; name: string; color: string; seats: number }
export interface SeatResult {
  id: string; name: string; state?: string; party: string; margin?: number;
  status: string; type: 'GEN' | 'SC' | 'ST';
}
export interface Highlight { parties: string[]; seats: string[] }
```
- Produces: `DashboardViewModel.voteShare: VoteShare[]` (new field); `MapPartyViewModel` becomes `type MapPartyViewModel = PartySeats`; `MapRegionViewModel extends SeatResult` adding `color, candidate, partyColor, recentChange`.

- [ ] **Step 1: Write the failing type test**

`src/model/types/__tests__/dashboard.test.ts`:
```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { SeatResult, PartySeats, LayerId } from '../dashboard';
import type { MapTab } from '../index';

describe('dashboard model types', () => {
  it('LayerId covers every legacy MapTab', () => {
    expectTypeOf<MapTab>().toMatchTypeOf<LayerId>();
  });
  it('SeatResult and PartySeats have the fields the derive layer needs', () => {
    expectTypeOf<SeatResult>().toHaveProperty('margin');
    expectTypeOf<PartySeats>().toHaveProperty('seats');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/model/types/__tests__/dashboard.test.ts`
Expected: FAIL — cannot resolve `../dashboard`.

- [ ] **Step 3: Move files with git and add shims**

```bash
mkdir -p src/model/api src/model/types src/model/geo src/model/live src/model/derive src/viewmodels/data src/views/map
git mv src/services/intelligence.service.ts src/model/derive/intelligence.ts
for f in src/services/*.ts; do git mv "$f" "src/model/api/$(basename "$f")"; done
git mv src/types/index.ts src/model/types/index.ts
git mv src/utils/regionMatching.ts src/model/geo/regionMatching.ts
git mv src/utils/normalizeConstId.ts src/model/geo/normalizeConstId.ts
git mv src/utils/geoHelpers.ts src/model/geo/geoHelpers.ts
git mv src/utils/liveUpdates.ts src/model/live/liveUpdates.ts
for f in src/hooks/*.ts src/hooks/*.tsx; do git mv "$f" "src/viewmodels/data/$(basename "$f")"; done
git mv src/components/organisms/useMapRendering.ts src/views/map/useMapRendering.ts
```

Create a shim at each old path that re-exports everything (plus the default export where the module has one):

```bash
shim() { # shim <old-path-without-ext> <import-target>
  local target="$2" newfile
  newfile=$(ls "$(dirname "$1")/$target".ts* 2>/dev/null | head -1)
  { echo "export * from \"$target\";"
    grep -q "export default" "$newfile" && echo "export { default } from \"$target\";"
  } > "$1.ts"
}
for f in src/model/api/*.ts; do b=$(basename "${f%.ts}"); shim "src/services/$b" "../model/api/$b"; done
shim src/services/intelligence.service ../model/derive/intelligence
for f in src/viewmodels/data/*.ts*; do b=$(basename "${f%.*}"); shim "src/hooks/$b" "../viewmodels/data/$b"; done
shim src/types/index ../model/types/index
for m in regionMatching normalizeConstId geoHelpers; do shim "src/utils/$m" "../model/geo/$m"; done
shim src/utils/liveUpdates ../model/live/liveUpdates
shim src/components/organisms/useMapRendering ../../views/map/useMapRendering
```
Check two results by hand: `cat src/hooks/useElection.ts` should show `export * from "../viewmodels/data/useElection";`, and `cat src/services/api.ts` should re-export `default` (its original has `export default apiFetch`).

Then fix relative imports **inside the moved files** so they point at their new neighbours (the shims make the old paths work, but moved files must not import through shims):
- in `src/model/api/*.ts`: `'../types'` → `'../types'` (unchanged — `model/types` is a sibling), `'../utils/X'` → `'../geo/X'` or `'../live/X'`.
- in `src/model/derive/intelligence.ts`: `'../types'` → `'../types'`.
- in `src/model/geo/*`, `src/model/live/*`: `'../types'` stays valid.
- in `src/viewmodels/data/*`: `'../services/X'` → `'../../model/api/X'`, `'../types'` → `'../../model/types'`, `'../utils/X'` → `'../../model/geo/X'` / `'../../model/live/X'`, `'./X'` (other hooks) unchanged.
- in `src/views/map/useMapRendering.ts`: `'../../utils/geoHelpers'` → `'../../model/geo/geoHelpers'`. (Views may import `model/geo` and `model/types`; only `model/api`, `model/derive`, `model/live` and `viewmodels/data` are off-limits to views.)

Run `npx tsc --noEmit` and fix each reported path until clean.

- [ ] **Step 4: Add the dashboard model types and adopt them in the data hook**

`src/model/types/dashboard.ts`:
```ts
import type { MapTab } from './index';

/** Map layer identifiers. Same values as the legacy MapTab. */
export type LayerId = MapTab;

/** A party with its current seat count (won + leading). */
export interface PartySeats {
  id: string;
  name: string;
  color: string;
  seats: number;
}

/** One constituency's current headline result. */
export interface SeatResult {
  id: string;
  name: string;
  /** GeoJSON st_name, when known (LS). */
  state?: string;
  /** Leading/winning party id, '' when pending. */
  party: string;
  /** Leader's margin; undefined when no leader yet. */
  margin?: number;
  /** WON | LEADING | PENDING */
  status: string;
  type: 'GEN' | 'SC' | 'ST';
}

/** A set of seats/parties to emphasise on the map. */
export interface Highlight {
  parties: string[];
  seats: string[];
}
```

In `src/viewmodels/data/useDashboardData.ts`:
```ts
import type { PartySeats, SeatResult } from '../../model/types/dashboard';
import type { VoteShare } from '../../model/types';

export interface MapRegionViewModel extends SeatResult {
  color: string;
  candidate: string;
  partyColor: string;
  recentChange: boolean;
}
export type MapPartyViewModel = PartySeats;
```
Delete the old `MapRegionViewModel` / `MapPartyViewModel` interface bodies, add `voteShare: VoteShare[];` to `DashboardViewModel`, and return `voteShare: voteShare || [],` from the hook.

- [ ] **Step 5: Run the full checks**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all existing tests (≈38) plus the new type test PASS; lint clean (fix any `no-unused-vars` errors lint reports in moved files by deleting the unused import/variable).

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "Reorganise frontend into model/viewmodels/views with re-export shims"
```

---

### Task 3: Model — fit math (`fitCount`)

**Files:**
- Create: `src/model/derive/fit.ts`
- Test: `src/model/derive/__tests__/fit.test.ts`

**Interfaces:**
- Produces:
```ts
export interface FitResult { count: number; overflow: number }
export function fitCount(opts: { available: number; itemHeight: number; total: number; gap?: number; footerHeight?: number }): FitResult
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fitCount } from '../fit';

describe('fitCount', () => {
  it('shows everything when it fits, with no footer', () => {
    expect(fitCount({ available: 400, itemHeight: 36, gap: 4, total: 5, footerHeight: 24 })).toEqual({ count: 5, overflow: 0 });
  });
  it('reserves footer space when items overflow', () => {
    // (300 - 24 + 4) / 40 = 7 rows, 33 hidden
    expect(fitCount({ available: 300, itemHeight: 36, gap: 4, total: 40, footerHeight: 24 })).toEqual({ count: 7, overflow: 33 });
  });
  it('always shows at least one row on very short tiles (1280x720 / ~650px windows)', () => {
    expect(fitCount({ available: 30, itemHeight: 36, gap: 4, total: 12, footerHeight: 24 })).toEqual({ count: 1, overflow: 11 });
  });
  it('before measurement (0px) shows one row instead of none', () => {
    expect(fitCount({ available: 0, itemHeight: 36, total: 3 })).toEqual({ count: 1, overflow: 2 });
  });
  it('handles an empty list', () => {
    expect(fitCount({ available: 300, itemHeight: 36, total: 0 })).toEqual({ count: 0, overflow: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/model/derive/__tests__/fit.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
export interface FitResult {
  count: number;
  overflow: number;
}

/**
 * How many fixed-height rows fit in `available` px. When not all rows fit,
 * space for a "+N more" footer is reserved. Never returns 0 rows for a
 * non-empty list, so a tile always shows something.
 */
export function fitCount({ available, itemHeight, total, gap = 0, footerHeight = 0 }: {
  available: number;
  itemHeight: number;
  total: number;
  gap?: number;
  footerHeight?: number;
}): FitResult {
  if (total <= 0) return { count: 0, overflow: 0 };
  const step = itemHeight + gap;
  const allHeight = total * itemHeight + (total - 1) * gap;
  if (available > 0 && allHeight <= available) return { count: total, overflow: 0 };
  const rows = Math.floor((available - footerHeight + gap) / step);
  const count = Math.min(total, Math.max(1, rows));
  return { count, overflow: total - count };
}
```

- [ ] **Step 4: Run to verify it passes** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/derive/fit.ts src/model/derive/__tests__/fit.test.ts
git commit -m "Add fitCount for no-scroll tiles"
```

---

### Task 4: Model — scoreboard derivation

**Files:**
- Create: `src/model/derive/scoreboard.ts`
- Test: `src/model/derive/__tests__/scoreboard.test.ts`

**Interfaces:**
- Consumes: `PartySeats` (Task 2), `ManifestAlliance` (`model/types`).
- Produces:
```ts
export interface ScoreBloc { id: string; name: string; color: string; seats: number; votePct: number | null; kind: 'alliance' | 'party' }
export interface Scoreboard {
  blocs: ScoreBloc[];                 // at most 2, biggest first
  others: { seats: number; votePct: number | null };
  totalSeats: number; majority: number; countedSeats: number;
  winnerId: string | null;            // bloc with seats >= majority
  marginOverMajority: number | null;  // winner seats - majority
}
export function deriveScoreboard(alliances: ManifestAlliance[], parties: PartySeats[], votePct: Map<string, number>, totalSeats: number, majority: number): Scoreboard
export function roundPct(n: number): number   // one decimal
```

- [ ] **Step 1: Write the failing test** (Bihar 2025 real numbers)

```ts
import { describe, it, expect } from 'vitest';
import { deriveScoreboard } from '../scoreboard';
import type { PartySeats } from '../../types/dashboard';

const parties: PartySeats[] = [
  { id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 89 },
  { id: 'JDU', name: 'Janata Dal (United)', color: '#1FA37A', seats: 85 },
  { id: 'RJD', name: 'Rashtriya Janata Dal', color: '#7BD34A', seats: 25 },
  { id: 'LJPRV', name: 'Lok Janshakti Party (Ram Vilas)', color: '#3B8BFF', seats: 19 },
  { id: 'INC', name: 'Indian National Congress', color: '#38C6F4', seats: 6 },
  { id: 'AIMIM', name: 'AIMIM', color: '#2BB673', seats: 5 },
  { id: 'HAMS', name: 'HAM(S)', color: '#E8C547', seats: 5 },
  { id: 'RLM', name: 'RLM', color: '#D06CB0', seats: 4 },
  { id: 'CPIML', name: 'CPI(ML)', color: '#E5484D', seats: 2 },
  { id: 'CPIM', name: 'CPI(M)', color: '#E5484D', seats: 1 },
  { id: 'IIP', name: 'IIP', color: '#8A93A6', seats: 1 },
  { id: 'BSP', name: 'BSP', color: '#4B5BD6', seats: 1 },
];
const alliances = [
  { id: 'NDA', name: 'NDA', color: '#FF7A1A', parties: ['BJP', 'JDU', 'LJPRV', 'HAMS', 'RLM'] },
  { id: 'MGB', name: 'Mahagathbandhan', color: '#7BD34A', parties: ['RJD', 'INC', 'CPIML', 'CPIM'] },
];

describe('deriveScoreboard', () => {
  it('sums alliance seats and vote share and computes others', () => {
    const pct = new Map([['BJP', 20.1], ['JDU', 19.2], ['LJPRV', 5], ['HAMS', 2.3], ['RLM', 1.5], ['RJD', 23], ['INC', 8.7], ['CPIML', 3], ['CPIM', 2.4]]);
    const s = deriveScoreboard(alliances, parties, pct, 243, 122);
    expect(s.blocs.map(b => [b.id, b.seats])).toEqual([['NDA', 202], ['MGB', 34]]);
    expect(s.blocs[0].votePct).toBe(48.1);
    expect(s.blocs[1].votePct).toBe(37.1);
    expect(s.others).toEqual({ seats: 7, votePct: 14.8 });
    expect(s.countedSeats).toBe(243);
    expect(s.winnerId).toBe('NDA');
    expect(s.marginOverMajority).toBe(80);
  });

  it('falls back to the top two parties when the manifest has no alliances', () => {
    const s = deriveScoreboard([], parties, new Map(), 243, 122);
    expect(s.blocs.map(b => [b.id, b.kind])).toEqual([['BJP', 'party'], ['JDU', 'party']]);
    expect(s.others.seats).toBe(243 - 89 - 85);
    expect(s.blocs[0].votePct).toBeNull();
    expect(s.winnerId).toBeNull();
  });

  it('handles zero results (upcoming election)', () => {
    const s = deriveScoreboard(alliances, parties.map(p => ({ ...p, seats: 0 })), new Map(), 243, 122);
    expect(s.countedSeats).toBe(0);
    expect(s.others.seats).toBe(0);
    expect(s.winnerId).toBeNull();
    expect(s.marginOverMajority).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/model/derive/__tests__/scoreboard.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
import type { ManifestAlliance } from '../types';
import type { PartySeats } from '../types/dashboard';

export interface ScoreBloc {
  id: string;
  name: string;
  color: string;
  seats: number;
  votePct: number | null;
  kind: 'alliance' | 'party';
}

export interface Scoreboard {
  blocs: ScoreBloc[];
  others: { seats: number; votePct: number | null };
  totalSeats: number;
  majority: number;
  countedSeats: number;
  winnerId: string | null;
  marginOverMajority: number | null;
}

export function roundPct(n: number): number {
  return Math.round(n * 10) / 10;
}

/** The two biggest blocs (alliances, or parties when no alliances are defined) plus "others". */
export function deriveScoreboard(
  alliances: ManifestAlliance[],
  parties: PartySeats[],
  votePct: Map<string, number>,
  totalSeats: number,
  majority: number,
): Scoreboard {
  const hasPct = votePct.size > 0;
  const countedSeats = parties.reduce((s, p) => s + p.seats, 0);

  const candidates: ScoreBloc[] = alliances.length > 0
    ? alliances.map(a => {
        const members = new Set(a.parties);
        const seats = parties.filter(p => members.has(p.id)).reduce((s, p) => s + p.seats, 0);
        const pct = a.parties.reduce((s, id) => s + (votePct.get(id) ?? 0), 0);
        return { id: a.id, name: a.name, color: a.color, seats, votePct: hasPct ? roundPct(pct) : null, kind: 'alliance' as const };
      })
    : parties.map(p => ({ id: p.id, name: p.name, color: p.color, seats: p.seats, votePct: hasPct ? roundPct(votePct.get(p.id) ?? 0) : null, kind: 'party' as const }));

  const blocs = [...candidates].sort((a, b) => b.seats - a.seats).slice(0, 2);
  const blocSeats = blocs.reduce((s, b) => s + b.seats, 0);
  const blocPct = blocs.reduce((s, b) => s + (b.votePct ?? 0), 0);
  const winner = blocs[0] && blocs[0].seats >= majority ? blocs[0] : null;

  return {
    blocs,
    others: { seats: Math.max(0, countedSeats - blocSeats), votePct: hasPct ? roundPct(Math.max(0, 100 - blocPct)) : null },
    totalSeats,
    majority,
    countedSeats,
    winnerId: winner?.id ?? null,
    marginOverMajority: winner ? winner.seats - majority : null,
  };
}
```

- [ ] **Step 4: Run to verify it passes** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/derive/scoreboard.ts src/model/derive/__tests__/scoreboard.test.ts
git commit -m "Add scoreboard derivation"
```

---

### Task 5: Model — standings rows and compact list

**Files:**
- Create: `src/model/derive/standings.ts`
- Test: `src/model/derive/__tests__/standings.test.ts`

**Interfaces:**
- Consumes: `PartySeats`, `ManifestAlliance`, `roundPct` (Task 4).
- Produces:
```ts
export interface StandingRow { id: string; name: string; color: string; seats: number; votePct: number | null; allianceId: string | null }
export function deriveStandingRows(parties: PartySeats[], votePct: Map<string, number>, alliances: ManifestAlliance[], opts?: { includeZero?: boolean }): StandingRow[]
export interface CompactList<T> { visible: T[]; moreCount: number; moreSeats: number }
export function compactList<T extends { seats: number }>(rows: T[], count: number): CompactList<T>
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { deriveStandingRows, compactList } from '../standings';

const parties = [
  { id: 'RJD', name: 'Rashtriya Janata Dal', color: '#7BD34A', seats: 25 },
  { id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 89 },
  { id: 'JSP', name: 'Jan Suraaj Party', color: '#999999', seats: 0 },
  { id: 'AIMIM', name: 'AIMIM', color: '#2BB673', seats: 5 },
  { id: 'HAMS', name: 'HAM(S)', color: '#E8C547', seats: 5 },
];
const alliances = [{ id: 'NDA', name: 'NDA', color: '#FF7A1A', parties: ['BJP', 'HAMS'] }];

describe('deriveStandingRows', () => {
  it('sorts by seats then name, drops zero-seat parties by default, tags alliances', () => {
    const rows = deriveStandingRows(parties, new Map([['BJP', 20.14]]), alliances);
    expect(rows.map(r => r.id)).toEqual(['BJP', 'RJD', 'AIMIM', 'HAMS']);
    expect(rows[0]).toMatchObject({ votePct: 20.1, allianceId: 'NDA' });
    expect(rows[1]).toMatchObject({ votePct: null, allianceId: null });
  });
  it('keeps zero-seat parties for the expanded table', () => {
    expect(deriveStandingRows(parties, new Map(), alliances, { includeZero: true })).toHaveLength(5);
  });
  it('returns no rows when nothing has been counted', () => {
    expect(deriveStandingRows(parties.map(p => ({ ...p, seats: 0 })), new Map(), alliances)).toEqual([]);
  });
});

describe('compactList', () => {
  it('reports hidden rows and their seats for the "+N more · M seats" footer', () => {
    const rows = deriveStandingRows(parties, new Map(), alliances);
    expect(compactList(rows, 2)).toMatchObject({ moreCount: 2, moreSeats: 10 });
    expect(compactList(rows, 2).visible.map(r => r.id)).toEqual(['BJP', 'RJD']);
  });
  it('has no footer when everything is visible', () => {
    expect(compactList([{ seats: 1 }], 5)).toEqual({ visible: [{ seats: 1 }], moreCount: 0, moreSeats: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

```ts
import type { ManifestAlliance } from '../types';
import type { PartySeats } from '../types/dashboard';
import { roundPct } from './scoreboard';

export interface StandingRow {
  id: string;
  name: string;
  color: string;
  seats: number;
  votePct: number | null;
  allianceId: string | null;
}

export function deriveStandingRows(
  parties: PartySeats[],
  votePct: Map<string, number>,
  alliances: ManifestAlliance[],
  { includeZero = false }: { includeZero?: boolean } = {},
): StandingRow[] {
  const allianceOf = new Map<string, string>();
  alliances.forEach(a => a.parties.forEach(p => allianceOf.set(p, a.id)));
  return parties
    .filter(p => includeZero || p.seats > 0)
    .map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      seats: p.seats,
      votePct: votePct.has(p.id) ? roundPct(votePct.get(p.id)!) : null,
      allianceId: allianceOf.get(p.id) ?? null,
    }))
    .sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));
}

export interface CompactList<T> {
  visible: T[];
  moreCount: number;
  moreSeats: number;
}

export function compactList<T extends { seats: number }>(rows: T[], count: number): CompactList<T> {
  const visible = rows.slice(0, Math.max(0, count));
  const hidden = rows.slice(visible.length);
  return { visible, moreCount: hidden.length, moreSeats: hidden.reduce((s, r) => s + r.seats, 0) };
}
```

- [ ] **Step 4: Run to verify it passes** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/derive/standings.ts src/model/derive/__tests__/standings.test.ts
git commit -m "Add standings rows and compact list"
```

---

### Task 6: Model — dashboard stats

**Files:**
- Create: `src/model/derive/stats.ts`
- Test: `src/model/derive/__tests__/stats.test.ts`

**Interfaces:**
- Consumes: `SeatResult`, `SwingEntry` (`model/types`).
- Produces:
```ts
export interface SeatRef { id: string; name: string; party: string; margin: number }
export interface DashboardStats { declared: number; total: number; closest: SeatRef | null; biggest: SeatRef | null; flipped: number | null }
export function deriveStats(seats: SeatResult[], totalSeats: number, swing: Map<string, SwingEntry> | null): DashboardStats
export function rankSeats(seats: SeatResult[], order: 'closest' | 'biggest', limit: number): SeatRef[]
export function flippedSeatRefs(seats: SeatResult[], swing: Map<string, SwingEntry>): SeatRef[]
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { deriveStats, rankSeats, flippedSeatRefs } from '../stats';
import type { SeatResult } from '../../types/dashboard';
import type { SwingEntry } from '../../types';

const seat = (id: string, party: string, margin: number | undefined, status = 'WON', name = id): SeatResult =>
  ({ id, name, party, margin, status, type: 'GEN' });

const vs: SeatResult[] = [
  seat('BR_VS_1_SANDESH', 'JDU', 27, 'WON', 'Sandesh'),
  seat('BR_VS_2_RUPAULI', 'JDU', 73572, 'WON', 'Rupauli'),
  seat('BR_VS_3_AGIAON', 'BJP', 95, 'WON', 'Agiaon'),
  seat('BR_VS_4_X', '', undefined, 'PENDING'),
];
const swing = new Map<string, SwingEntry>([
  ['BR_VS_1_SANDESH', { constId: 'BR_VS_1_SANDESH', currentParty: 'JDU', prevParty: 'RJD', currentMargin: 27, prevMargin: 900, flipped: true }],
  ['BR_VS_2_RUPAULI', { constId: 'BR_VS_2_RUPAULI', currentParty: 'JDU', prevParty: 'JDU', currentMargin: 73572, prevMargin: 19000, flipped: false }],
]);

describe('deriveStats', () => {
  it('computes declared, closest, biggest and flips', () => {
    expect(deriveStats(vs, 243, swing)).toEqual({
      declared: 3,
      total: 243,
      closest: { id: 'BR_VS_1_SANDESH', name: 'Sandesh', party: 'JDU', margin: 27 },
      biggest: { id: 'BR_VS_2_RUPAULI', name: 'Rupauli', party: 'JDU', margin: 73572 },
      flipped: 1,
    });
  });
  it('uses leading seats when nothing is declared yet (live)', () => {
    const live = [seat('A', 'BJP', 500, 'LEADING'), seat('B', 'INC', 50, 'LEADING')];
    const s = deriveStats(live, 543, null);
    expect(s.declared).toBe(0);
    expect(s.closest?.id).toBe('B');
    expect(s.flipped).toBeNull();
  });
  it('returns nulls instead of crashing when every seat is pending', () => {
    expect(deriveStats([seat('A', '', undefined, 'PENDING')], 243, new Map())).toEqual({ declared: 0, total: 243, closest: null, biggest: null, flipped: null });
  });
  it('works for Lok Sabha bare ids', () => {
    const ls = [seat('AGRA', 'BJP', 271294), seat('AURANGABAD_BR', 'RJD', 79111)];
    expect(deriveStats(ls, 543, null).closest?.id).toBe('AURANGABAD_BR');
  });
});

describe('rankSeats / flippedSeatRefs', () => {
  it('ranks closest ascending and biggest descending', () => {
    expect(rankSeats(vs, 'closest', 2).map(s => s.margin)).toEqual([27, 95]);
    expect(rankSeats(vs, 'biggest', 1).map(s => s.margin)).toEqual([73572]);
  });
  it('lists flipped seats closest first', () => {
    expect(flippedSeatRefs(vs, swing).map(s => s.id)).toEqual(['BR_VS_1_SANDESH']);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

```ts
import type { SwingEntry } from '../types';
import type { SeatResult } from '../types/dashboard';

export interface SeatRef {
  id: string;
  name: string;
  party: string;
  margin: number;
}

export interface DashboardStats {
  declared: number;
  total: number;
  closest: SeatRef | null;
  biggest: SeatRef | null;
  flipped: number | null;
}

const toRef = (s: SeatResult): SeatRef => ({ id: s.id, name: s.name, party: s.party, margin: s.margin as number });

/** Declared seats if any, otherwise leading seats — the pool the stats talk about. */
function pool(seats: SeatResult[]): SeatResult[] {
  const withMargin = seats.filter(s => s.margin != null && s.party);
  const won = withMargin.filter(s => s.status === 'WON');
  return won.length > 0 ? won : withMargin.filter(s => s.status === 'LEADING');
}

export function rankSeats(seats: SeatResult[], order: 'closest' | 'biggest', limit: number): SeatRef[] {
  const sorted = [...pool(seats)].sort((a, b) => (order === 'closest' ? a.margin! - b.margin! : b.margin! - a.margin!));
  return sorted.slice(0, limit).map(toRef);
}

export function flippedSeatRefs(seats: SeatResult[], swing: Map<string, SwingEntry>): SeatRef[] {
  return seats
    .filter(s => swing.get(s.id)?.flipped && s.margin != null)
    .sort((a, b) => a.margin! - b.margin!)
    .map(toRef);
}

export function deriveStats(seats: SeatResult[], totalSeats: number, swing: Map<string, SwingEntry> | null): DashboardStats {
  let flipped: number | null = null;
  if (swing && swing.size > 0) {
    flipped = 0;
    for (const e of swing.values()) if (e.flipped) flipped++;
  }
  return {
    declared: seats.filter(s => s.status === 'WON').length,
    total: totalSeats,
    closest: rankSeats(seats, 'closest', 1)[0] ?? null,
    biggest: rankSeats(seats, 'biggest', 1)[0] ?? null,
    flipped,
  };
}
```

- [ ] **Step 4: Run to verify it passes** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/derive/stats.ts src/model/derive/__tests__/stats.test.ts
git commit -m "Add dashboard stats derivation"
```

---

### Task 7: Model — leader cards

**Files:**
- Create: `src/model/derive/leaders.ts`
- Test: `src/model/derive/__tests__/leaders.test.ts`

**Interfaces:**
- Consumes: `ManifestData`, `ResultRow` (`model/types`), `displayNameFromConstId` (`model/geo/regionMatching`).
- Produces:
```ts
export interface LeaderEntry { name: string; partyId: string; constId: string; role?: string }
export type LeaderStatus = 'WON' | 'LEADING' | 'LOST' | 'TRAILING' | 'PENDING';
export interface LeaderCard { key: string; name: string; role?: string; constId: string; constName: string; partyId: string; status: LeaderStatus; margin: number | null; custom: boolean }
export interface CustomWatch { const_id: string; label: string }
export function collectLeaderEntries(manifest: ManifestData | null, custom: CustomWatch[]): (LeaderEntry & { custom: boolean })[]
export function deriveLeaderCards(entries: (LeaderEntry & { custom: boolean })[], winners: Map<string, ResultRow>): LeaderCard[]
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { collectLeaderEntries, deriveLeaderCards } from '../leaders';
import type { ResultRow } from '../../types';

const winners = new Map<string, ResultRow>([
  ['BR_VS_128_RAGHOPUR', { const_id: 'BR_VS_128_RAGHOPUR', party_id: 'RJD', candidate_name: 'TEJASHWI PRASAD YADAV', votes: 1, status: 'WON', margin: 14532 }],
  ['BR_VS_164_TARAPUR', { const_id: 'BR_VS_164_TARAPUR', party_id: 'BJP', candidate_name: 'SAMRAT CHOUDHARY', votes: 1, status: 'LEADING', margin: 200 }],
]);

describe('collectLeaderEntries', () => {
  it('flattens watchlists, de-duplicates, then appends custom seats', () => {
    const manifest = { watchlists: [
      { id: 'a', name: 'Leaders', entries: [{ name: 'Tejashwi Yadav', party_id: 'RJD', const_id: 'BR_VS_128_RAGHOPUR' }] },
      { id: 'b', name: 'Cabinet', entries: [{ name: 'Tejashwi Yadav', party_id: 'RJD', const_id: 'BR_VS_128_RAGHOPUR', role: 'LoP' }] },
    ] };
    const e = collectLeaderEntries(manifest, [{ const_id: 'BR_VS_164_TARAPUR', label: 'Tarapur' }]);
    expect(e.map(x => [x.constId, x.custom])).toEqual([['BR_VS_128_RAGHOPUR', false], ['BR_VS_164_TARAPUR', true]]);
  });
  it('falls back to legacy leaders/cabinet when there are no watchlists', () => {
    const e = collectLeaderEntries({ leaders: [{ name: 'X', party_id: 'BJP', const_id: 'C1' }], cabinet: [{ name: 'Y', role: 'Min', party_id: 'JDU', const_id: 'C2' }] }, []);
    expect(e.map(x => x.constId)).toEqual(['C1', 'C2']);
    expect(e[1].role).toBe('Min');
  });
  it('returns an empty list without a manifest', () => {
    expect(collectLeaderEntries(null, [])).toEqual([]);
  });
});

describe('deriveLeaderCards', () => {
  it('marks won/leading when the leader is the entry party, lost/trailing otherwise, pending with no result', () => {
    const cards = deriveLeaderCards([
      { name: 'Tejashwi Yadav', partyId: 'RJD', constId: 'BR_VS_128_RAGHOPUR', custom: false },
      { name: 'Rival', partyId: 'INC', constId: 'BR_VS_164_TARAPUR', custom: false },
      { name: 'Unknown', partyId: 'BJP', constId: 'BR_VS_1_X', custom: false },
      { name: 'Tarapur', partyId: '', constId: 'BR_VS_164_TARAPUR', custom: true },
    ], winners);
    expect(cards.map(c => [c.status, c.margin])).toEqual([['WON', 14532], ['TRAILING', 200], ['PENDING', null], ['LEADING', 200]]);
    expect(cards[3].name).toBe('SAMRAT CHOUDHARY');
    expect(cards[0].constName).toBe('Raghopur');
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

```ts
import type { ManifestData, ResultRow } from '../types';
import { displayNameFromConstId } from '../geo/regionMatching';

export interface LeaderEntry {
  name: string;
  partyId: string;
  constId: string;
  role?: string;
}

export type LeaderStatus = 'WON' | 'LEADING' | 'LOST' | 'TRAILING' | 'PENDING';

export interface LeaderCard {
  key: string;
  name: string;
  role?: string;
  constId: string;
  constName: string;
  partyId: string;
  status: LeaderStatus;
  margin: number | null;
  custom: boolean;
}

export interface CustomWatch {
  const_id: string;
  label: string;
}

type Entry = LeaderEntry & { custom: boolean };

export function collectLeaderEntries(manifest: ManifestData | null, custom: CustomWatch[]): Entry[] {
  const out: Entry[] = [];
  const seen = new Set<string>();
  const push = (e: Entry) => {
    const key = `${e.constId}|${e.name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };
  const watchlists = manifest?.watchlists?.filter(w => w.entries.length > 0) ?? [];
  if (watchlists.length > 0) {
    watchlists.forEach(w => w.entries.forEach(x => push({ name: x.name, partyId: x.party_id, constId: x.const_id, role: x.role, custom: false })));
  } else {
    manifest?.leaders?.forEach(l => push({ name: l.name, partyId: l.party_id, constId: l.const_id, custom: false }));
    manifest?.cabinet?.forEach(c => push({ name: c.name, partyId: c.party_id, constId: c.const_id, role: c.role, custom: false }));
  }
  custom.forEach(c => push({ name: c.label, partyId: '', constId: c.const_id, custom: true }));
  return out;
}

export function deriveLeaderCards(entries: Entry[], winners: Map<string, ResultRow>): LeaderCard[] {
  return entries.map(e => {
    const w = winners.get(e.constId);
    let status: LeaderStatus = 'PENDING';
    if (w) {
      const isEntryParty = !e.partyId || e.partyId === w.party_id;
      const declared = w.status === 'WON';
      status = isEntryParty ? (declared ? 'WON' : 'LEADING') : (declared ? 'LOST' : 'TRAILING');
    }
    return {
      key: `${e.constId}|${e.name}`,
      name: e.custom && w ? w.candidate_name : e.name,
      role: e.role,
      constId: e.constId,
      constName: displayNameFromConstId(e.constId),
      partyId: e.partyId || w?.party_id || '',
      status,
      margin: w ? Number(w.margin) || 0 : null,
      custom: e.custom,
    };
  });
}
```

Note: check `displayNameFromConstId('BR_VS_128_RAGHOPUR')` returns `'Raghopur'`; if it returns a different casing, change the expectation in the test to the function's actual output (it is the same helper the legacy UI uses).

- [ ] **Step 4: Run to verify it passes** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/derive/leaders.ts src/model/derive/__tests__/leaders.test.ts
git commit -m "Add leader card derivation"
```

---

### Task 8: Model — layer insights (all seven layers)

**Files:**
- Create: `src/model/derive/layerInsights.ts`
- Test: `src/model/derive/__tests__/layerInsights.test.ts`

**Interfaces:**
- Consumes: `SeatResult`, `LayerId`, `ManifestAlliance`, `SwingEntry`, `DominanceEntry`, `IncumbencyEntry`, `VoteSplitConfig`, `ResultRow`, `median` from `components/organisms/summary/stats` (move `countDeclared/leaderMargins/median` into `src/model/derive/marginStats.ts` in this task and leave a shim at the old path).
- Produces:
```ts
export interface InsightChip {
  id: string;
  label: string;          // display text: party ids, bucket labels ("< 1K"), or a key under labelKey
  labelKey?: string;      // i18n key when the label is translatable
  color: string;
  fromColor?: string;     // swing flows
  count: number;
  seatIds: string[];
}
export interface LayerInsight { layer: LayerId; headlineKey: string; headlineParams: Record<string, string | number>; chips: InsightChip[] }
export interface InsightContext {
  electionType: 'LS' | 'VS';
  seats: SeatResult[];
  alliances: ManifestAlliance[];
  partyColor: Map<string, string>;
  swing?: Map<string, SwingEntry>;
  prevYear?: number | null;
  dominance?: Map<string, DominanceEntry>;
  incumbency?: IncumbencyEntry[];
  voteSplits?: VoteSplitConfig[];
  constCandidates?: Map<string, ResultRow[]>;
  threeWaySeats?: Set<string>;
}
export const MARGIN_BUCKETS: Record<'LS' | 'VS', { label: string; max: number }[]>;
export const CLOSE_THRESHOLD: Record<'LS' | 'VS', number>;   // VS 1000, LS 5000
export function deriveLayerInsight(layer: LayerId, ctx: InsightContext): LayerInsight | null
```
Headline keys (added to locales in Task 18): `studio_insight_overview` (`{{text}}`), `studio_insight_battle` (`{{median}}`, `{{close}}`, `{{threshold}}`), `studio_insight_swing` (`{{flipped}}`, `{{total}}`, `{{year}}`), `studio_insight_history` (`{{strongholds}}`, `{{swing}}`), `studio_insight_reserved` (`{{sc}}`, `{{st}}`), `studio_insight_spoilers` (`{{count}}`), `studio_insight_threeway` (`{{count}}`), `studio_insight_states` (`{{states}}`). Chip label keys: `studio_chip_stronghold`, `studio_chip_loyal`, `studio_chip_swing`, `studio_chip_anti_incumbency`.

- [ ] **Step 1: Move margin helpers**

```bash
git mv src/components/organisms/summary/stats.ts src/model/derive/marginStats.ts
printf 'export * from "../../../model/derive/marginStats";\n' > src/components/organisms/summary/stats.ts
```
Fix `src/model/derive/marginStats.ts`'s import of `Region` from `./types` → declare the parameter types inline: `Pick<{ status?: string; margin?: number }, 'status' | 'margin'>[]`.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { deriveLayerInsight, type InsightContext } from '../layerInsights';
import type { SeatResult } from '../../types/dashboard';
import type { SwingEntry, DominanceEntry, ResultRow } from '../../types';

const s = (id: string, party: string, margin: number, type: 'GEN' | 'SC' | 'ST' = 'GEN', state?: string): SeatResult =>
  ({ id, name: id, party, margin, status: 'WON', type, state });

const alliances = [
  { id: 'NDA', name: 'NDA', color: '#FF7A1A', parties: ['BJP', 'JDU'] },
  { id: 'MGB', name: 'MGB', color: '#7BD34A', parties: ['RJD', 'INC'] },
];
const partyColor = new Map([['BJP', '#FF7A1A'], ['JDU', '#1FA37A'], ['RJD', '#7BD34A'], ['INC', '#38C6F4'], ['AIMIM', '#2BB673']]);
const seats = [s('A', 'JDU', 27, 'SC'), s('B', 'BJP', 800), s('C', 'BJP', 12000, 'ST'), s('D', 'RJD', 3000), s('E', 'JDU', 60000)];
const base: InsightContext = { electionType: 'VS', seats, alliances, partyColor };

const flip = (id: string, prev: string, cur: string): [string, SwingEntry] =>
  [id, { constId: id, prevParty: prev, currentParty: cur, currentMargin: 1, prevMargin: 1, flipped: prev !== cur }];

describe('deriveLayerInsight', () => {
  it('overview: bloc text and top parties', () => {
    const r = deriveLayerInsight('overview', base)!;
    expect(r.headlineKey).toBe('studio_insight_overview');
    expect(r.headlineParams.text).toBe('NDA 4 · MGB 1');
    expect(r.chips.map(c => [c.id, c.count])).toEqual([['BJP', 2], ['JDU', 2], ['RJD', 1]]);
  });

  it('battle: median, close seats and margin buckets', () => {
    const r = deriveLayerInsight('battle', base)!;
    expect(r.headlineParams).toEqual({ median: 3000, close: 2, threshold: 1000 });
    expect(r.chips.map(c => [c.label, c.count])).toEqual([['< 1K', 2], ['1–5K', 1], ['5–15K', 1], ['15–50K', 0], ['50K+', 1]]);
  });

  it('swing: flipped count and top flows; null without a previous election', () => {
    const swing = new Map([flip('A', 'RJD', 'JDU'), flip('B', 'RJD', 'BJP'), flip('E', 'RJD', 'JDU'), flip('D', 'RJD', 'RJD')]);
    const r = deriveLayerInsight('swing', { ...base, swing, prevYear: 2020 })!;
    expect(r.headlineParams).toEqual({ flipped: 3, total: 4, year: 2020 });
    expect(r.chips[0]).toMatchObject({ id: 'RJD>JDU', label: 'RJD → JDU', count: 2, fromColor: '#7BD34A', color: '#1FA37A', seatIds: ['A', 'E'] });
    expect(deriveLayerInsight('swing', { ...base, swing: new Map() })).toBeNull();
  });

  it('history: classification buckets and anti-incumbency', () => {
    const dominance = new Map<string, DominanceEntry>([
      ['A', { constId: 'A', winners: [], classification: 'stronghold', dominantParty: 'JDU', streak: 3 }],
      ['B', { constId: 'B', winners: [], classification: 'swing', streak: 1 }],
      ['C', { constId: 'C', winners: [], classification: 'loyal', dominantParty: 'BJP', streak: 2 }],
    ]);
    const r = deriveLayerInsight('history', { ...base, dominance, incumbency: [{ constId: 'D', incumbentName: 'x', incumbentParty: 'RJD', won: false, currentMargin: 1 }] })!;
    expect(r.headlineParams).toEqual({ strongholds: 1, swing: 1 });
    expect(r.chips.map(c => [c.labelKey, c.count])).toEqual([['studio_chip_stronghold', 1], ['studio_chip_loyal', 1], ['studio_chip_swing', 1], ['studio_chip_anti_incumbency', 1]]);
    expect(deriveLayerInsight('history', base)).toBeNull();
  });

  it('reserved: SC/ST counts and winners among reserved seats', () => {
    const r = deriveLayerInsight('demographics', base)!;
    expect(r.headlineParams).toEqual({ sc: 1, st: 1 });
    expect(r.chips.map(c => c.id)).toEqual(['BJP', 'JDU']);
  });

  it('insights: spoiler seats per vote-split config', () => {
    const cc = new Map<string, ResultRow[]>([
      ['A', [
        { const_id: 'A', party_id: 'JDU', candidate_name: 'w', votes: 1000, status: 'WON', margin: 27 },
        { const_id: 'A', party_id: 'RJD', candidate_name: 'r', votes: 973, status: 'LOST', margin: 0 },
        { const_id: 'A', party_id: 'AIMIM', candidate_name: 's', votes: 400, status: 'LOST', margin: 0 },
      ]],
    ]);
    const r = deriveLayerInsight('insights', { ...base, constCandidates: cc, voteSplits: [{ spoiler: 'AIMIM', hurts: 'MGB', label: 'AIMIM split' }] })!;
    expect(r.headlineKey).toBe('studio_insight_spoilers');
    expect(r.chips).toEqual([{ id: 'AIMIM', label: 'AIMIM split', color: '#2BB673', count: 1, seatIds: ['A'] }]);
  });

  it('insights without vote splits falls back to three-way contests', () => {
    const r = deriveLayerInsight('insights', { ...base, threeWaySeats: new Set(['B', 'C']) })!;
    expect(r).toMatchObject({ headlineKey: 'studio_insight_threeway', headlineParams: { count: 2 } });
  });

  it('states (LS): states led by each alliance', () => {
    const ls: InsightContext = { ...base, electionType: 'LS', seats: [s('AGRA', 'BJP', 1, 'GEN', 'Uttar Pradesh'), s('ALIGARH', 'BJP', 1, 'GEN', 'Uttar Pradesh'), s('PATNA', 'RJD', 1, 'GEN', 'Bihar'), s('X', 'INC', 1)] };
    const r = deriveLayerInsight('states', ls)!;
    expect(r.headlineParams).toEqual({ states: 2 });
    expect(r.chips.map(c => [c.id, c.count, c.seatIds.length])).toEqual([['NDA', 1, 2], ['MGB', 1, 1]]);
  });
});
```

- [ ] **Step 3: Run to verify it fails** → FAIL.

- [ ] **Step 4: Implement**

```ts
import type { ManifestAlliance, SwingEntry, DominanceEntry, IncumbencyEntry, VoteSplitConfig, ResultRow } from '../types';
import type { LayerId, SeatResult } from '../types/dashboard';
import { median } from './marginStats';

export interface InsightChip {
  id: string;
  label: string;
  labelKey?: string;
  color: string;
  fromColor?: string;
  count: number;
  seatIds: string[];
}

export interface LayerInsight {
  layer: LayerId;
  headlineKey: string;
  headlineParams: Record<string, string | number>;
  chips: InsightChip[];
}

export interface InsightContext {
  electionType: 'LS' | 'VS';
  seats: SeatResult[];
  alliances: ManifestAlliance[];
  partyColor: Map<string, string>;
  swing?: Map<string, SwingEntry>;
  prevYear?: number | null;
  dominance?: Map<string, DominanceEntry>;
  incumbency?: IncumbencyEntry[];
  voteSplits?: VoteSplitConfig[];
  constCandidates?: Map<string, ResultRow[]>;
  threeWaySeats?: Set<string>;
}

export const MARGIN_BUCKETS: Record<'LS' | 'VS', { label: string; max: number }[]> = {
  LS: [{ label: '< 5K', max: 5000 }, { label: '5–25K', max: 25000 }, { label: '25–75K', max: 75000 }, { label: '75–200K', max: 200000 }, { label: '200K+', max: Infinity }],
  VS: [{ label: '< 1K', max: 1000 }, { label: '1–5K', max: 5000 }, { label: '5–15K', max: 15000 }, { label: '15–50K', max: 50000 }, { label: '50K+', max: Infinity }],
};
export const CLOSE_THRESHOLD: Record<'LS' | 'VS', number> = { LS: 5000, VS: 1000 };

const MAX_CHIPS = 6;
const ACCENT = 'var(--color-accent)';
const GREY = '#8A93A6';

const led = (ctx: InsightContext) => ctx.seats.filter(s => s.party && s.margin != null);
const colorOf = (ctx: InsightContext, party: string) => ctx.partyColor.get(party) ?? GREY;

function partyChips(ctx: InsightContext, seats: SeatResult[]): InsightChip[] {
  const byParty = new Map<string, string[]>();
  seats.forEach(s => byParty.set(s.party, [...(byParty.get(s.party) ?? []), s.id]));
  return [...byParty.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, MAX_CHIPS)
    .map(([party, ids]) => ({ id: party, label: party, color: colorOf(ctx, party), count: ids.length, seatIds: ids }));
}

function allianceOf(ctx: InsightContext): Map<string, ManifestAlliance> {
  const m = new Map<string, ManifestAlliance>();
  ctx.alliances.forEach(a => a.parties.forEach(p => m.set(p, a)));
  return m;
}

function overview(ctx: InsightContext): LayerInsight {
  const seats = led(ctx);
  const al = allianceOf(ctx);
  const counts = new Map<string, number>();
  let others = 0;
  seats.forEach(s => {
    const a = al.get(s.party);
    if (a) counts.set(a.name, (counts.get(a.name) ?? 0) + 1);
    else others++;
  });
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`);
  if (others > 0 && ctx.alliances.length > 0) parts.push(`Others ${others}`);
  return { layer: 'overview', headlineKey: 'studio_insight_overview', headlineParams: { text: parts.join(' · ') }, chips: partyChips(ctx, seats) };
}

function battle(ctx: InsightContext): LayerInsight {
  const seats = led(ctx);
  const buckets = MARGIN_BUCKETS[ctx.electionType];
  const threshold = CLOSE_THRESHOLD[ctx.electionType];
  const chips = buckets.map((b, i): InsightChip => {
    const lo = i === 0 ? -Infinity : buckets[i - 1].max;
    const ids = seats.filter(s => s.margin! >= lo && s.margin! < b.max).map(s => s.id);
    return { id: `bucket-${i}`, label: b.label, color: ACCENT, count: ids.length, seatIds: ids };
  });
  const margins = seats.map(s => s.margin!).sort((a, b) => a - b);
  return {
    layer: 'battle',
    headlineKey: 'studio_insight_battle',
    headlineParams: { median: median(margins), close: margins.filter(m => m < threshold).length, threshold },
    chips,
  };
}

function swing(ctx: InsightContext): LayerInsight | null {
  if (!ctx.swing || ctx.swing.size === 0) return null;
  const flows = new Map<string, { prev: string; cur: string; ids: string[] }>();
  let flipped = 0;
  for (const e of ctx.swing.values()) {
    if (!e.flipped) continue;
    flipped++;
    const key = `${e.prevParty}>${e.currentParty}`;
    const f = flows.get(key) ?? { prev: e.prevParty, cur: e.currentParty, ids: [] };
    f.ids.push(e.constId);
    flows.set(key, f);
  }
  const chips = [...flows.entries()]
    .sort((a, b) => b[1].ids.length - a[1].ids.length || a[0].localeCompare(b[0]))
    .slice(0, MAX_CHIPS)
    .map(([key, f]) => ({ id: key, label: `${f.prev} → ${f.cur}`, fromColor: colorOf(ctx, f.prev), color: colorOf(ctx, f.cur), count: f.ids.length, seatIds: f.ids }));
  return { layer: 'swing', headlineKey: 'studio_insight_swing', headlineParams: { flipped, total: ctx.swing.size, year: ctx.prevYear ?? '' }, chips };
}

function history(ctx: InsightContext): LayerInsight | null {
  if (!ctx.dominance || ctx.dominance.size === 0) return null;
  const by = { stronghold: [] as string[], loyal: [] as string[], swing: [] as string[] };
  for (const d of ctx.dominance.values()) if (d.classification in by) by[d.classification as keyof typeof by].push(d.constId);
  const anti = (ctx.incumbency ?? []).filter(i => !i.won).map(i => i.constId);
  const chip = (id: keyof typeof by | 'anti_incumbency', ids: string[], color: string): InsightChip =>
    ({ id, label: id, labelKey: `studio_chip_${id}`, color, count: ids.length, seatIds: ids });
  return {
    layer: 'history',
    headlineKey: 'studio_insight_history',
    headlineParams: { strongholds: by.stronghold.length, swing: by.swing.length },
    chips: [chip('stronghold', by.stronghold, ACCENT), chip('loyal', by.loyal, ACCENT), chip('swing', by.swing, 'var(--color-map-swing)'), chip('anti_incumbency', anti, 'var(--color-live)')],
  };
}

function reserved(ctx: InsightContext): LayerInsight | null {
  const res = led(ctx).filter(s => s.type === 'SC' || s.type === 'ST');
  const sc = ctx.seats.filter(s => s.type === 'SC').length;
  const st = ctx.seats.filter(s => s.type === 'ST').length;
  if (sc + st === 0) return null;
  return { layer: 'demographics', headlineKey: 'studio_insight_reserved', headlineParams: { sc, st }, chips: partyChips(ctx, res) };
}

function insights(ctx: InsightContext): LayerInsight {
  const splits = ctx.voteSplits ?? [];
  if (splits.length > 0 && ctx.constCandidates) {
    const al = allianceOf(ctx);
    const union = new Set<string>();
    const chips = splits.map((cfg): InsightChip => {
      const ids: string[] = [];
      for (const [id, cands] of ctx.constCandidates!) {
        if (cands.length < 2) continue;
        const [w, r] = cands;
        const spoiler = cands.find(c => c.party_id === cfg.spoiler);
        if (spoiler && spoiler !== w && spoiler.votes > w.votes - r.votes && al.get(r.party_id)?.id === cfg.hurts) ids.push(id);
      }
      ids.forEach(i => union.add(i));
      return { id: cfg.spoiler, label: cfg.label, color: colorOf(ctx, cfg.spoiler), count: ids.length, seatIds: ids };
    });
    return { layer: 'insights', headlineKey: 'studio_insight_spoilers', headlineParams: { count: union.size }, chips };
  }
  const three = [...(ctx.threeWaySeats ?? [])];
  return { layer: 'insights', headlineKey: 'studio_insight_threeway', headlineParams: { count: three.length }, chips: [] };
}

function states(ctx: InsightContext): LayerInsight | null {
  if (ctx.electionType !== 'LS') return null;
  const al = allianceOf(ctx);
  const byState = new Map<string, SeatResult[]>();
  led(ctx).forEach(s => { if (s.state) byState.set(s.state, [...(byState.get(s.state) ?? []), s]); });
  const leaders = new Map<string, { a: ManifestAlliance; states: number; seatIds: string[] }>();
  for (const seats of byState.values()) {
    const tally = new Map<string, number>();
    seats.forEach(s => { const a = al.get(s.party); if (a) tally.set(a.id, (tally.get(a.id) ?? 0) + 1); });
    const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
    if (!top) continue;
    const a = ctx.alliances.find(x => x.id === top[0])!;
    const entry = leaders.get(a.id) ?? { a, states: 0, seatIds: [] };
    entry.states++;
    entry.seatIds.push(...seats.map(s => s.id));
    leaders.set(a.id, entry);
  }
  const chips = [...leaders.values()].sort((x, y) => y.states - x.states)
    .map(l => ({ id: l.a.id, label: l.a.name, color: l.a.color, count: l.states, seatIds: l.seatIds }));
  return { layer: 'states', headlineKey: 'studio_insight_states', headlineParams: { states: byState.size }, chips };
}

export function deriveLayerInsight(layer: LayerId, ctx: InsightContext): LayerInsight | null {
  switch (layer) {
    case 'overview': return overview(ctx);
    case 'battle': return battle(ctx);
    case 'swing': return swing(ctx);
    case 'history': return history(ctx);
    case 'demographics': return reserved(ctx);
    case 'insights': return insights(ctx);
    case 'states': return states(ctx);
  }
}
```

- [ ] **Step 5: Run to verify it passes** → `npx vitest run src/model/derive/__tests__/layerInsights.test.ts` PASS; also `npm test` (legacy `summaryStats.test.ts` still passes through the shim).

- [ ] **Step 6: Commit**

```bash
git add -A src/model/derive src/components/organisms/summary/stats.ts
git commit -m "Add layer insight derivation for all map layers"
```

---

### Task 9: Model — map fills and feature matching

**Files:**
- Create: `src/model/derive/mapFill.ts`, `src/model/geo/featureMatch.ts`
- Test: `src/model/derive/__tests__/mapFill.test.ts`, `src/model/geo/__tests__/featureMatch.test.ts`

**Interfaces:**
- Consumes: `SeatResult`, `LayerId`, `SwingEntry`, `DominanceEntry`; `buildRegionLookup`, `findRegionForFeature` (`model/geo/regionMatching`), `GeoFeature` (`model/geo/geoHelpers`).
- Produces:
```ts
export interface SeatFill { color: string; opacity: number }
export interface FillContext {
  layer: LayerId; electionType: 'LS' | 'VS';
  partyColor: Map<string, string>;
  swing?: Map<string, SwingEntry>; dominance?: Map<string, DominanceEntry>;
  spoilerSeats?: Set<string>; threeWaySeats?: Set<string>;
  highlight: { parties: Set<string>; seats: Set<string> };
}
export const MAP_FILL: { pending: string; swing: string; threeWay: string };
export const DIM_OPACITY = 0.12;
export function marginOpacity(margin: number | undefined, electionType: 'LS' | 'VS'): number
export function seatFill(seat: SeatResult, ctx: FillContext): SeatFill
export function seatFills(seats: SeatResult[], ctx: FillContext): Map<string, SeatFill>
// featureMatch.ts
export function matchFeaturesToSeats<S extends { id: string; name: string }>(features: GeoFeature[], seats: S[]): Map<GeoFeature, string>
```

- [ ] **Step 1: Write the failing tests**

`mapFill.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { seatFill, marginOpacity, MAP_FILL, DIM_OPACITY, type FillContext } from '../mapFill';
import type { SeatResult } from '../../types/dashboard';

const seat = (over: Partial<SeatResult> = {}): SeatResult => ({ id: 'A', name: 'A', party: 'BJP', margin: 30000, status: 'WON', type: 'GEN', ...over });
const ctx = (over: Partial<FillContext> = {}): FillContext => ({
  layer: 'overview', electionType: 'VS', partyColor: new Map([['BJP', '#FF7A1A'], ['JDU', '#1FA37A']]),
  highlight: { parties: new Set(), seats: new Set() }, ...over,
});

describe('seatFill', () => {
  it('pending seats use the pending colour on every layer', () => {
    expect(seatFill(seat({ party: '', margin: undefined, status: 'PENDING' }), ctx({ layer: 'battle' }))).toEqual({ color: MAP_FILL.pending, opacity: 1 });
  });
  it('overview: solid party colour', () => {
    expect(seatFill(seat(), ctx())).toEqual({ color: '#FF7A1A', opacity: 1 });
  });
  it('battle: close margins are dimmer than safe ones', () => {
    expect(seatFill(seat({ margin: 500 }), ctx({ layer: 'battle' })).opacity).toBeLessThan(seatFill(seat({ margin: 60000 }), ctx({ layer: 'battle' })).opacity);
  });
  it('swing: flipped seats solid in the new party colour, held seats dim', () => {
    const swing = new Map([
      ['A', { constId: 'A', prevParty: 'JDU', currentParty: 'BJP', currentMargin: 1, prevMargin: 1, flipped: true }],
      ['B', { constId: 'B', prevParty: 'BJP', currentParty: 'BJP', currentMargin: 1, prevMargin: 1, flipped: false }],
    ]);
    expect(seatFill(seat(), ctx({ layer: 'swing', swing }))).toEqual({ color: '#FF7A1A', opacity: 1 });
    expect(seatFill(seat({ id: 'B' }), ctx({ layer: 'swing', swing })).opacity).toBe(0.18);
  });
  it('history: strongholds solid, loyal lighter, swing seats in the swing colour', () => {
    const dominance = new Map([
      ['A', { constId: 'A', winners: [], classification: 'stronghold' as const, dominantParty: 'JDU', streak: 3 }],
      ['B', { constId: 'B', winners: [], classification: 'loyal' as const, dominantParty: 'BJP', streak: 2 }],
      ['C', { constId: 'C', winners: [], classification: 'swing' as const, streak: 1 }],
    ]);
    expect(seatFill(seat(), ctx({ layer: 'history', dominance }))).toEqual({ color: '#1FA37A', opacity: 1 });
    expect(seatFill(seat({ id: 'B' }), ctx({ layer: 'history', dominance }))).toEqual({ color: '#FF7A1A', opacity: 0.55 });
    expect(seatFill(seat({ id: 'C' }), ctx({ layer: 'history', dominance }))).toEqual({ color: MAP_FILL.swing, opacity: 1 });
  });
  it('reserved: SC/ST solid, general seats dim', () => {
    expect(seatFill(seat({ type: 'SC' }), ctx({ layer: 'demographics' })).opacity).toBe(1);
    expect(seatFill(seat(), ctx({ layer: 'demographics' })).opacity).toBe(DIM_OPACITY);
  });
  it('insights: spoiler seats solid, three-way in amber, rest dim', () => {
    const c = ctx({ layer: 'insights', spoilerSeats: new Set(['A']), threeWaySeats: new Set(['B']) });
    expect(seatFill(seat(), c).opacity).toBe(1);
    expect(seatFill(seat({ id: 'B' }), c)).toEqual({ color: MAP_FILL.threeWay, opacity: 1 });
    expect(seatFill(seat({ id: 'Z' }), c).opacity).toBe(DIM_OPACITY);
  });
  it('an active highlight dims every seat outside it', () => {
    const c = ctx({ highlight: { parties: new Set(['JDU']), seats: new Set(['K']) } });
    expect(seatFill(seat(), c).opacity).toBe(DIM_OPACITY);
    expect(seatFill(seat({ id: 'K' }), c).opacity).toBe(1);
    expect(seatFill(seat({ party: 'JDU' }), c).opacity).toBe(1);
  });
});

describe('marginOpacity', () => {
  it('maps VS margin buckets to rising opacity', () => {
    expect([500, 3000, 10000, 30000, 80000].map(m => marginOpacity(m, 'VS'))).toEqual([0.25, 0.45, 0.65, 0.85, 1]);
  });
});
```

`featureMatch.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchFeaturesToSeats } from '../featureMatch';
import type { GeoFeature } from '../geoHelpers';

const f = (props: Record<string, unknown>) => ({ type: 'Feature', properties: props, geometry: null }) as unknown as GeoFeature;

describe('matchFeaturesToSeats', () => {
  it('matches VS features by number+name and LS features by name, keeping same-named seats in different states apart', () => {
    const feats = [f({ ac_no: 128, ac_name: 'RAGHOPUR', st_name: 'Bihar' }), f({ pc_name: 'Aurangabad', st_name: 'Bihar', pc_no: 37 }), f({ pc_name: 'Aurangabad', st_name: 'Maharashtra', pc_no: 19 })];
    const seats = [
      { id: 'BR_VS_128_RAGHOPUR', name: 'Raghopur' },
      { id: 'BR_AURANGABAD', name: 'Aurangabad', state: 'Bihar' },
      { id: 'MH_AURANGABAD', name: 'Aurangabad', state: 'Maharashtra' },
    ];
    const m = matchFeaturesToSeats(feats, seats);
    expect([...m.values()]).toEqual(['BR_VS_128_RAGHOPUR', 'BR_AURANGABAD', 'MH_AURANGABAD']);
  });
});
```
(The property names above mirror what `buildRegionLookup`/`findRegionForFeature` already handle — if the legacy helpers use different geojson property names, copy the names from `src/model/geo/regionMatching.ts` into this fixture. The behaviour under test — reusing the legacy matcher — must not change.)

- [ ] **Step 2: Run to verify they fail** → FAIL.

- [ ] **Step 3: Implement**

`src/model/geo/featureMatch.ts`:
```ts
import { buildRegionLookup, findRegionForFeature } from './regionMatching';
import type { GeoFeature } from './geoHelpers';

/** Feature → seat id, using the same matcher as the legacy map (number+name, then state+name, then name). */
export function matchFeaturesToSeats<S extends { id: string; name: string; state?: string }>(features: GeoFeature[], seats: S[]): Map<GeoFeature, string> {
  const lookup = buildRegionLookup(seats);
  const out = new Map<GeoFeature, string>();
  for (const feat of features) {
    const seat = findRegionForFeature(lookup, feat.properties);
    if (seat) out.set(feat, seat.id);
  }
  return out;
}
```

`src/model/derive/mapFill.ts`:
```ts
import type { SwingEntry, DominanceEntry } from '../types';
import type { LayerId, SeatResult } from '../types/dashboard';
import { MARGIN_BUCKETS } from './layerInsights';

export interface SeatFill { color: string; opacity: number }

export interface FillContext {
  layer: LayerId;
  electionType: 'LS' | 'VS';
  partyColor: Map<string, string>;
  swing?: Map<string, SwingEntry>;
  dominance?: Map<string, DominanceEntry>;
  spoilerSeats?: Set<string>;
  threeWaySeats?: Set<string>;
  highlight: { parties: Set<string>; seats: Set<string> };
}

export const MAP_FILL = {
  pending: 'var(--color-map-pending)',
  swing: 'var(--color-map-swing)',
  threeWay: 'var(--color-map-threeway)',
};
export const DIM_OPACITY = 0.12;
const HELD_OPACITY = 0.18;
const LOYAL_OPACITY = 0.55;
const BUCKET_OPACITY = [0.25, 0.45, 0.65, 0.85, 1];

export function marginOpacity(margin: number | undefined, electionType: 'LS' | 'VS'): number {
  if (margin == null) return 1;
  const buckets = MARGIN_BUCKETS[electionType];
  const i = buckets.findIndex(b => margin < b.max);
  return BUCKET_OPACITY[i < 0 ? BUCKET_OPACITY.length - 1 : i];
}

function layerFill(seat: SeatResult, ctx: FillContext): SeatFill {
  const color = ctx.partyColor.get(seat.party) ?? '#8A93A6';
  switch (ctx.layer) {
    case 'battle':
      return { color, opacity: marginOpacity(seat.margin, ctx.electionType) };
    case 'swing': {
      const e = ctx.swing?.get(seat.id);
      return e?.flipped ? { color, opacity: 1 } : { color, opacity: HELD_OPACITY };
    }
    case 'history': {
      const d = ctx.dominance?.get(seat.id);
      if (!d || d.classification === 'new') return { color: MAP_FILL.pending, opacity: 1 };
      if (d.classification === 'swing') return { color: MAP_FILL.swing, opacity: 1 };
      const dc = ctx.partyColor.get(d.dominantParty ?? '') ?? color;
      return { color: dc, opacity: d.classification === 'stronghold' ? 1 : LOYAL_OPACITY };
    }
    case 'demographics':
      return { color, opacity: seat.type === 'GEN' ? DIM_OPACITY : 1 };
    case 'insights':
      if (ctx.spoilerSeats?.has(seat.id)) return { color, opacity: 1 };
      if (ctx.threeWaySeats?.has(seat.id)) return { color: MAP_FILL.threeWay, opacity: 1 };
      return { color, opacity: DIM_OPACITY };
    default:
      return { color, opacity: 1 };
  }
}

export function seatFill(seat: SeatResult, ctx: FillContext): SeatFill {
  if (!seat.party) return { color: MAP_FILL.pending, opacity: 1 };
  const fill = layerFill(seat, ctx);
  const { parties, seats } = ctx.highlight;
  const active = parties.size > 0 || seats.size > 0;
  if (active && !seats.has(seat.id) && !parties.has(seat.party)) return { ...fill, opacity: DIM_OPACITY };
  return fill;
}

export function seatFills(seats: SeatResult[], ctx: FillContext): Map<string, SeatFill> {
  const out = new Map<string, SeatFill>();
  for (const s of seats) out.set(s.id, seatFill(s, ctx));
  return out;
}
```

- [ ] **Step 4: Run to verify they pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/derive/mapFill.ts src/model/geo/featureMatch.ts src/model/derive/__tests__/mapFill.test.ts src/model/geo/__tests__/featureMatch.test.ts
git commit -m "Add map fill model and feature-to-seat matching"
```

---

### Task 10: ViewModel — DashboardStore (reducer + URL sync)

**Files:**
- Create: `src/viewmodels/store/dashboardStore.ts`, `src/viewmodels/store/DashboardStoreProvider.tsx`
- Test: `src/viewmodels/__tests__/dashboardStore.test.ts`, `src/viewmodels/__tests__/DashboardStoreProvider.test.tsx`

**Interfaces:**
- Consumes: `LayerId`, `Highlight` (Task 2).
- Produces:
```ts
export type FocusTile = 'map' | 'scoreboard' | 'standings' | 'insight' | 'leaders' | 'stats';
export type MapMode = 'map' | 'hex';
export interface DashboardUiState { layer: LayerId; mapMode: MapMode; selectedSeat: string | null; hover: Highlight | null; locked: { chipId: string; highlight: Highlight } | null; focus: FocusTile | null }
export type DashboardAction =
  | { type: 'setLayer'; layer: LayerId } | { type: 'setMapMode'; mode: MapMode }
  | { type: 'selectSeat'; seat: string | null } | { type: 'hover'; highlight: Highlight | null }
  | { type: 'toggleLock'; chipId: string; highlight: Highlight } | { type: 'clearLock' }
  | { type: 'focus'; tile: FocusTile | null } | { type: 'syncFromUrl'; params: Partial<DashboardUiState> };
export const initialUiState: DashboardUiState;
export function dashboardReducer(s: DashboardUiState, a: DashboardAction): DashboardUiState
export function activeHighlight(s: DashboardUiState): { parties: Set<string>; seats: Set<string> }
export const ALL_LAYERS: LayerId[];
export function parseUiParams(params: URLSearchParams, knownSeats: Set<string> | null): Partial<DashboardUiState>
export function effectiveLayer(requested: LayerId, allowed: LayerId[]): LayerId   // 'overview' when requested isn't available (yet)
export function serializeUiParams(s: DashboardUiState, base: URLSearchParams): URLSearchParams
// Provider — `state.layer` is the EFFECTIVE layer; the URL keeps the requested one,
// so ?layer=swing survives while the previous-election analysis is still loading.
export function DashboardStoreProvider(props: { allowedLayers: LayerId[]; knownSeats: Set<string> | null; children: ReactNode }): JSX.Element
export function useDashboardStore(): { state: DashboardUiState; dispatch: Dispatch<DashboardAction> }
```

- [ ] **Step 1: Write the failing reducer test**

```ts
import { describe, it, expect } from 'vitest';
import { dashboardReducer, initialUiState, activeHighlight, parseUiParams, serializeUiParams, effectiveLayer } from '../store/dashboardStore';

const hl = { parties: ['BJP'], seats: [] };

describe('dashboardReducer', () => {
  it('changing layer clears a locked highlight', () => {
    const locked = dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'BJP', highlight: hl });
    expect(dashboardReducer(locked, { type: 'setLayer', layer: 'swing' })).toMatchObject({ layer: 'swing', locked: null });
  });
  it('toggleLock on the same chip unlocks', () => {
    const once = dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'BJP', highlight: hl });
    expect(dashboardReducer(once, { type: 'toggleLock', chipId: 'BJP', highlight: hl }).locked).toBeNull();
  });
  it('selecting a seat opens the map focus view', () => {
    expect(dashboardReducer(initialUiState, { type: 'selectSeat', seat: 'X' })).toMatchObject({ selectedSeat: 'X', focus: 'map' });
  });
  it('closing focus also clears the selected seat', () => {
    const s = dashboardReducer(initialUiState, { type: 'selectSeat', seat: 'X' });
    expect(dashboardReducer(s, { type: 'focus', tile: null })).toMatchObject({ focus: null, selectedSeat: null });
  });
});

describe('activeHighlight', () => {
  it('prefers the locked highlight over hover', () => {
    let s = dashboardReducer(initialUiState, { type: 'toggleLock', chipId: 'c', highlight: { parties: [], seats: ['A'] } });
    s = dashboardReducer(s, { type: 'hover', highlight: hl });
    expect([...activeHighlight(s).seats]).toEqual(['A']);
  });
});

describe('URL params', () => {
  it('round-trips layer, seat and focus', () => {
    const s = { ...initialUiState, layer: 'swing' as const, selectedSeat: 'A', focus: 'map' as const };
    const p = serializeUiParams(s, new URLSearchParams('keep=1'));
    expect(p.toString()).toBe('keep=1&layer=swing&seat=A&focus=map');
    expect(parseUiParams(p, new Set(['A']))).toEqual({ layer: 'swing', selectedSeat: 'A', focus: 'map' });
  });
  it('ignores bogus values from hand-edited URLs', () => {
    const p = new URLSearchParams('layer=bogus&focus=nope&seat=NOT_A_SEAT');
    expect(parseUiParams(p, new Set(['A']))).toEqual({ layer: 'overview', selectedSeat: null, focus: null });
  });
  it('accepts any seat while the seat list is still loading', () => {
    expect(parseUiParams(new URLSearchParams('seat=X'), null).selectedSeat).toBe('X');
  });
  it('shows overview for a layer this election does not have (yet)', () => {
    expect(effectiveLayer('swing', ['overview', 'battle'])).toBe('overview');
    expect(effectiveLayer('swing', ['overview', 'swing'])).toBe('swing');
  });
  it('does not write default values', () => {
    expect(serializeUiParams(initialUiState, new URLSearchParams()).toString()).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement the reducer**

```ts
import type { LayerId, Highlight } from '../../model/types/dashboard';

export type FocusTile = 'map' | 'scoreboard' | 'standings' | 'insight' | 'leaders' | 'stats';
export type MapMode = 'map' | 'hex';

export interface DashboardUiState {
  layer: LayerId;
  mapMode: MapMode;
  selectedSeat: string | null;
  hover: Highlight | null;
  locked: { chipId: string; highlight: Highlight } | null;
  focus: FocusTile | null;
}

export type DashboardAction =
  | { type: 'setLayer'; layer: LayerId }
  | { type: 'setMapMode'; mode: MapMode }
  | { type: 'selectSeat'; seat: string | null }
  | { type: 'hover'; highlight: Highlight | null }
  | { type: 'toggleLock'; chipId: string; highlight: Highlight }
  | { type: 'clearLock' }
  | { type: 'focus'; tile: FocusTile | null }
  | { type: 'syncFromUrl'; params: Partial<DashboardUiState> };

export const initialUiState: DashboardUiState = { layer: 'overview', mapMode: 'map', selectedSeat: null, hover: null, locked: null, focus: null };

const FOCUS_TILES: FocusTile[] = ['map', 'scoreboard', 'standings', 'insight', 'leaders', 'stats'];

export function dashboardReducer(s: DashboardUiState, a: DashboardAction): DashboardUiState {
  switch (a.type) {
    case 'setLayer': return { ...s, layer: a.layer, locked: null, hover: null };
    case 'setMapMode': return { ...s, mapMode: a.mode };
    case 'selectSeat': return a.seat ? { ...s, selectedSeat: a.seat, focus: 'map' } : { ...s, selectedSeat: null };
    case 'hover': return { ...s, hover: a.highlight };
    case 'toggleLock': return { ...s, locked: s.locked?.chipId === a.chipId ? null : { chipId: a.chipId, highlight: a.highlight } };
    case 'clearLock': return { ...s, locked: null };
    case 'focus': return a.tile ? { ...s, focus: a.tile } : { ...s, focus: null, selectedSeat: null };
    case 'syncFromUrl': return { ...s, ...a.params };
  }
}

export function activeHighlight(s: DashboardUiState): { parties: Set<string>; seats: Set<string> } {
  const h = s.locked?.highlight ?? s.hover;
  return { parties: new Set(h?.parties ?? []), seats: new Set(h?.seats ?? []) };
}

export const ALL_LAYERS: LayerId[] = ['overview', 'battle', 'swing', 'history', 'demographics', 'insights', 'states'];

export function parseUiParams(params: URLSearchParams, knownSeats: Set<string> | null): Partial<DashboardUiState> {
  const layer = params.get('layer') as LayerId | null;
  const focus = params.get('focus') as FocusTile | null;
  const seat = params.get('seat');
  return {
    layer: layer && ALL_LAYERS.includes(layer) ? layer : 'overview',
    selectedSeat: seat && (knownSeats === null || knownSeats.has(seat)) ? seat : null,
    focus: focus && FOCUS_TILES.includes(focus) ? focus : null,
  };
}

export function effectiveLayer(requested: LayerId, allowed: LayerId[]): LayerId {
  return allowed.includes(requested) ? requested : 'overview';
}

export function serializeUiParams(s: DashboardUiState, base: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  ['layer', 'seat', 'focus'].forEach(k => p.delete(k));
  if (s.layer !== 'overview') p.set('layer', s.layer);
  if (s.selectedSeat) p.set('seat', s.selectedSeat);
  if (s.focus) p.set('focus', s.focus);
  return p;
}
```

Note: `knownSeats === null` means "seats not loaded yet — accept the seat for now"; the provider re-parses once seats load, which drops unknown seats.

- [ ] **Step 4: Run to verify it passes** → PASS.

- [ ] **Step 5: Write the failing provider test**

`src/viewmodels/__tests__/DashboardStoreProvider.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      <DashboardStoreProvider allowedLayers={['overview', 'swing']} knownSeats={new Set(['A'])}>{children}</DashboardStoreProvider>
    </MemoryRouter>
  );
  return renderHook(() => ({ store: useDashboardStore(), loc: useLocation() }), { wrapper });
}

describe('DashboardStoreProvider', () => {
  it('initialises from the URL and writes changes back', () => {
    const { result } = setup('/election/x?layer=swing');
    expect(result.current.store.state.layer).toBe('swing');
    act(() => result.current.store.dispatch({ type: 'selectSeat', seat: 'A' }));
    expect(result.current.loc.search).toBe('?layer=swing&seat=A&focus=map');
  });
  it('drops an unknown seat from the URL', () => {
    const { result } = setup('/election/x?seat=ZZZ');
    expect(result.current.store.state.selectedSeat).toBeNull();
  });
  it('shows overview for an unavailable layer but keeps it in the URL', () => {
    const { result } = setup('/election/x?layer=history');
    expect(result.current.store.state.layer).toBe('overview');
    expect(result.current.loc.search).toBe('?layer=history');
  });
});
```

- [ ] **Step 6: Run to verify it fails** → FAIL.

- [ ] **Step 7: Implement the provider**

```tsx
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LayerId } from '../../model/types/dashboard';
import { dashboardReducer, effectiveLayer, initialUiState, parseUiParams, serializeUiParams, type DashboardAction, type DashboardUiState } from './dashboardStore';

interface StoreValue { state: DashboardUiState; dispatch: Dispatch<DashboardAction> }
const StoreContext = createContext<StoreValue | null>(null);

export function DashboardStoreProvider({ allowedLayers, knownSeats, children }: { allowedLayers: LayerId[]; knownSeats: Set<string> | null; children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const [raw, dispatch] = useReducer(dashboardReducer, undefined, () => ({ ...initialUiState, ...parseUiParams(params, knownSeats) }));

  // URL → state (back/forward, pasted links, late-loading seat list). Idempotent after our own writes.
  useEffect(() => {
    dispatch({ type: 'syncFromUrl', params: parseUiParams(params, knownSeats) });
  }, [params, knownSeats]);

  // state → URL (the REQUESTED layer is written, not the effective one). Opening focus or a seat pushes history so Back closes it.
  useEffect(() => {
    const next = serializeUiParams(raw, params);
    if (next.toString() === params.toString()) return;
    const pushes = next.get('focus') !== params.get('focus') || next.get('seat') !== params.get('seat');
    setParams(next, { replace: !pushes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw.layer, raw.selectedSeat, raw.focus]);

  const allowedKey = allowedLayers.join(',');
  const state = useMemo(
    () => ({ ...raw, layer: effectiveLayer(raw.layer, allowedLayers) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, allowedKey],
  );
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useDashboardStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useDashboardStore must be used inside DashboardStoreProvider');
  return v;
}
```

- [ ] **Step 8: Run to verify it passes** → `npx vitest run src/viewmodels/__tests__` PASS.

- [ ] **Step 9: Commit**

```bash
git add src/viewmodels/store src/viewmodels/__tests__
git commit -m "Add URL-synced DashboardStore"
```

---

### Task 11: ViewModel — dashboard sources (data, analysis, live, ticker)

**Files:**
- Create: `src/model/live/ticker.ts`, `src/viewmodels/sources/useDashboardSources.ts`, `src/viewmodels/sources/DashboardSourcesProvider.tsx`
- Test: `src/model/live/__tests__/ticker.test.ts`

**Interfaces:**
- Consumes: `useDashboardData`, `useAnalysis`, `useHistoryAnalysis`, `useHistoricalResults`, `useSSE`, `useElection` (all in `viewmodels/data`), `LeaderChange` (`model/live/liveUpdates`), `displayNameFromConstId`.
- Produces:
```ts
// ticker.ts
export interface TickerEvent { id: string; constId: string; constName: string; partyId: string; kind: 'won' | 'lead'; margin: number; at: number }
export const MAX_TICKER = 20;
export function appendTicker(prev: TickerEvent[], changes: LeaderChange[], now?: number): TickerEvent[]
// sources
export interface DashboardSources {
  election: Election;
  data: DashboardViewModel;
  swing: Map<string, SwingEntry>; dominance: Map<string, DominanceEntry>;
  incumbency: IncumbencyEntry[]; partySwitches: PartySwitchEntry[];
  marginTrend: MarginTrendPoint[]; prevYear: number | null;
  totalSeats: number; majority: number;
  votePct: Map<string, number>;
  ticker: TickerEvent[]; recentSeats: Set<string>; sseConnected: boolean;
  availableLayers: LayerId[];
}
export function useDashboardSources(election: Election): DashboardSources
export function DashboardSourcesProvider(props: { value: DashboardSources; children: ReactNode }): JSX.Element
export function useSources(): DashboardSources
```

- [ ] **Step 1: Write the failing ticker test**

```ts
import { describe, it, expect } from 'vitest';
import { appendTicker, MAX_TICKER } from '../ticker';

describe('appendTicker', () => {
  it('prepends newest events and caps the list', () => {
    const first = appendTicker([], [{ const_id: 'BR_VS_128_RAGHOPUR', party_id: 'RJD', margin: 400, kind: 'lead' }], 1000);
    expect(first[0]).toMatchObject({ constName: 'Raghopur', partyId: 'RJD', kind: 'lead', margin: 400, at: 1000 });
    let list = first;
    for (let i = 0; i < 30; i++) list = appendTicker(list, [{ const_id: `X${i}`, party_id: 'BJP', margin: i, kind: 'won' }], 2000 + i);
    expect(list).toHaveLength(MAX_TICKER);
    expect(list[0].constId).toBe('X29');
  });
  it('returns the same array when there are no changes', () => {
    const prev = appendTicker([], [{ const_id: 'A', party_id: 'BJP', margin: 1, kind: 'won' }], 1);
    expect(appendTicker(prev, [])).toBe(prev);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement `ticker.ts`**

```ts
import type { LeaderChange } from './liveUpdates';
import { displayNameFromConstId } from '../geo/regionMatching';

export interface TickerEvent {
  id: string;
  constId: string;
  constName: string;
  partyId: string;
  kind: 'won' | 'lead';
  margin: number;
  at: number;
}

export const MAX_TICKER = 20;

export function appendTicker(prev: TickerEvent[], changes: LeaderChange[], now: number = Date.now()): TickerEvent[] {
  if (changes.length === 0) return prev;
  const added = changes.map((c, i): TickerEvent => ({
    id: `${c.const_id}-${now}-${i}`,
    constId: c.const_id,
    constName: displayNameFromConstId(c.const_id),
    partyId: c.party_id,
    kind: c.kind,
    margin: c.margin,
    at: now,
  }));
  return [...added.reverse(), ...prev].slice(0, MAX_TICKER);
}
```

- [ ] **Step 4: Run to verify it passes** → PASS.

- [ ] **Step 5: Implement `useDashboardSources`** (logic ported from `src/pages/Dashboard.tsx` lines 55–120 and 160–170 of the baseline)

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardData } from '../data/useDashboardData';
import { useHistoryAnalysis } from '../data/useHistoryAnalysis';
import { useHistoricalResults } from '../data/useHistoricalResults';
import { useAnalysis } from '../data/useAnalysis';
import { useSSE } from '../data/useSSE';
import { useElection } from '../data/useElection';
import { appendTicker, type TickerEvent } from '../../model/live/ticker';
import type { Election, SSEEvent, SwingEntry, DominanceEntry, IncumbencyEntry, PartySwitchEntry, MarginTrendPoint } from '../../model/types';
import type { LayerId } from '../../model/types/dashboard';
import type { DashboardViewModel } from '../data/useDashboardData';

const RECENT_CHANGE_MS = 3000;
const EMPTY_YEARS: number[] = [];

export interface DashboardSources {
  election: Election;
  data: DashboardViewModel;
  swing: Map<string, SwingEntry>;
  dominance: Map<string, DominanceEntry>;
  incumbency: IncumbencyEntry[];
  partySwitches: PartySwitchEntry[];
  marginTrend: MarginTrendPoint[];
  prevYear: number | null;
  totalSeats: number;
  majority: number;
  votePct: Map<string, number>;
  ticker: TickerEvent[];
  recentSeats: Set<string>;
  sseConnected: boolean;
  availableLayers: LayerId[];
}

export function useDashboardSources(election: Election): DashboardSources {
  const data = useDashboardData(election);
  const { setSseConnected } = useElection();
  const { manifestData, results, currentWinnerMap, constCandidates, mapRegions, voteShare, applyLiveUpdate } = data;

  const historyResults = useHistoricalResults(manifestData?.history);
  const prevResults = historyResults && historyResults.length > 0 ? historyResults[historyResults.length - 1] : null;
  const allConstIds = useMemo(() => [...constCandidates.keys()], [constCandidates]);
  const ha = useHistoryAnalysis({
    results, currentWinnerMap, allHistResults: historyResults, prevResults, allConstIds,
    historyYears: manifestData?.history_years || EMPTY_YEARS, currentYear: election.year,
  });
  const ba = useAnalysis(election.status === 'Finalized' ? election.id : undefined);

  const swing = ba.swingMap.size > 0 ? ba.swingMap : ha.swingMap;
  const dominance = ba.dominanceMap.size > 0 ? ba.dominanceMap : ha.dominanceMap;
  const incumbency = ba.incumbencyData.length > 0 ? ba.incumbencyData : ha.incumbencyData;
  const partySwitches = ba.partySwitchData.length > 0 ? ba.partySwitchData : ha.partySwitchData;
  const years = manifestData?.history_years ?? [];
  const prevYear = years.length > 0 ? years[years.length - 1] : null;

  const totalSeats = election.type === 'LS' ? (mapRegions.length || 543) : (election.state?.total_assembly_seats || mapRegions.length);
  const majorityMilestone = manifestData?.milestones?.find(m => /majority/i.test(m.label))?.value;
  const majority = majorityMilestone || Math.floor(totalSeats / 2) + 1;
  const votePct = useMemo(() => new Map(voteShare.map(v => [v.party_id, Number(v.percentage)])), [voteShare]);

  // Live: ticker + recent-change pulses.
  const [ticker, setTicker] = useState<TickerEvent[]>([]);
  const [recentSeats, setRecentSeats] = useState<Set<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  const markRecent = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setRecentSeats(prev => new Set([...prev, ...ids]));
    for (const id of ids) {
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => {
        timers.current.delete(id);
        setRecentSeats(prev => { const n = new Set(prev); n.delete(id); return n; });
      }, RECENT_CHANGE_MS));
    }
  }, []);
  const handleSSE = useCallback((event: SSEEvent) => {
    const rows = event.type === 'batch-update' ? event.data : [event.data];
    if (rows.length === 0) return;
    const changes = applyLiveUpdate(rows);
    markRecent(changes.map(c => c.const_id));
    setTicker(prev => appendTicker(prev, changes));
  }, [applyLiveUpdate, markRecent]);
  const { connected: sseConnected } = useSSE(election.status === 'Live' ? election.id : undefined, handleSSE);
  useEffect(() => { setSseConnected(sseConnected); }, [sseConnected, setSseConnected]);

  const availableLayers = useMemo((): LayerId[] => {
    const l: LayerId[] = ['overview', 'battle'];
    if (swing.size > 0) l.push('swing');
    if (dominance.size > 0) l.push('history');
    l.push('demographics', 'insights');
    if (election.type === 'LS') l.push('states');
    return l;
  }, [swing.size, dominance.size, election.type]);

  return {
    election, data, swing, dominance, incumbency, partySwitches, marginTrend: ha.marginTrend, prevYear,
    totalSeats, majority, votePct, ticker, recentSeats, sseConnected, availableLayers,
  };
}
```

`DashboardSourcesProvider.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { DashboardSources } from './useDashboardSources';

const SourcesContext = createContext<DashboardSources | null>(null);

export function DashboardSourcesProvider({ value, children }: { value: DashboardSources; children: ReactNode }) {
  return <SourcesContext.Provider value={value}>{children}</SourcesContext.Provider>;
}

export function useSources(): DashboardSources {
  const v = useContext(SourcesContext);
  if (!v) throw new Error('useSources must be used inside DashboardSourcesProvider');
  return v;
}
```

- [ ] **Step 6: Run the checks** — `npx vitest run && npx tsc --noEmit && npm run lint` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/model/live/ticker.ts src/model/live/__tests__ src/viewmodels/sources
git commit -m "Add dashboard sources view-model and live ticker"
```

---

### Task 12: ViewModels — one hook per tile

**Files:**
- Create: `src/viewmodels/tiles/{useScoreboardVM,useStandingsVM,useLayerInsightVM,useLeadersVM,useStatsVM,useTopBarVM,useSeatPanelVM}.ts`
- Test: `src/viewmodels/__tests__/tileVMs.test.tsx`, `src/viewmodels/__tests__/fixtures.ts`

**Interfaces:**
- Consumes: `useSources()` (Task 11), `useDashboardStore()` (Task 10), all derive functions (Tasks 3–8), `useLocalStorage`, `useApi`, `useElection`, `useGlobalSearch` (`viewmodels/data`), `getElections`, `getStates` (`model/api`).
- Produces:
```ts
export interface ScoreboardVM extends Scoreboard { status: 'final' | 'live' | 'upcoming'; pulse: boolean; breakdown: { id: string; name: string; color: string; rows: StandingRow[] }[]; onFocus(): void; onHoverBloc(id: string | null): void; onLockBloc(id: string): void; lockedId: string | null }
export interface StandingsVM { rows: StandingRow[]; allRows: StandingRow[]; pulse: boolean; lockedId: string | null; onFocus(): void; onHoverParty(id: string | null): void; onLockParty(id: string): void }
export interface LayerInsightVM { layer: LayerId; insight: LayerInsight | null; lockedChipId: string | null; onFocus(): void; onHoverChip(c: InsightChip | null): void; onLockChip(c: InsightChip): void; netSwing: { id: string; name: string; color: string; gained: number; lost: number }[]; marginTrend: MarginTrendPoint[]; partySwitches: PartySwitchEntry[] }
export interface LeadersVM { cards: LeaderCard[]; partyColor: Map<string, string>; onFocus(): void; onSelectSeat(id: string): void; onHoverSeat(id: string | null): void; onAddCustom(constId: string): void; onRemoveCustom(constId: string): void; seatOptions: { id: string; name: string }[] }
export interface StatsVM { stats: DashboardStats; closest10: SeatRef[]; biggest10: SeatRef[]; flipped: SeatRef[]; ticker: TickerEvent[]; isLive: boolean; partyColor: Map<string, string>; onFocus(): void; onSelectSeat(id: string): void }
export interface TopBarVM { electionType: 'LS' | 'VS'; states: { id: number; name: string }[]; stateId: number | null; years: { id: string; year: number }[]; electionId: string; statusLabel: { kind: 'final' | 'live' | 'upcoming'; declared: number; total: number }; shareText: string; lang: string; langs: string[]; onType(t: 'LS' | 'VS'): void; onState(id: number): void; onElection(id: string): void; onLang(l: string): void; onSearchSeat(id: string): void; lsElections: { id: string; name: string }[] }
export interface SeatPanelVM { seatId: string; name: string; candidates: { name: string; partyId: string; color: string; votes: number; status: string }[]; margin: number | null; history: { classification: string; dominantParty: string | null } | null; briefing: string | null; fullPageHref: string; onClose(): void }
export function useScoreboardVM(): ScoreboardVM
export function useStandingsVM(): StandingsVM
export function useLayerInsightVM(): LayerInsightVM
export function useLeadersVM(): LeadersVM
export function useStatsVM(): StatsVM
export function useTopBarVM(): TopBarVM
export function useSeatPanelVM(): SeatPanelVM | null
```

- [ ] **Step 1: Write fixtures and the failing VM tests**

`src/viewmodels/__tests__/fixtures.ts`:
```ts
import type { DashboardSources } from '../sources/useDashboardSources';
import type { ResultRow } from '../../model/types';

const rows: ResultRow[] = [
  { const_id: 'BR_VS_1_SANDESH', party_id: 'JDU', candidate_name: 'RADHA CHARAN SAH', votes: 1000, status: 'WON', margin: 27 },
  { const_id: 'BR_VS_1_SANDESH', party_id: 'RJD', candidate_name: 'R', votes: 973, status: 'LOST', margin: 0 },
  { const_id: 'BR_VS_2_RUPAULI', party_id: 'JDU', candidate_name: 'KALADHAR PRASAD MANDAL', votes: 90000, status: 'WON', margin: 73572 },
  { const_id: 'BR_VS_3_AGIAON', party_id: 'BJP', candidate_name: 'MAHESH PASWAN', votes: 5000, status: 'WON', margin: 95 },
];

export function makeSources(over: Partial<DashboardSources> = {}): DashboardSources {
  const winners = new Map(rows.filter(r => r.status === 'WON').map(r => [r.const_id, r]));
  const cc = new Map<string, ResultRow[]>();
  rows.forEach(r => cc.set(r.const_id, [...(cc.get(r.const_id) ?? []), r]));
  const mapRegions = [...winners.values()].map(w => ({
    id: w.const_id, name: w.const_id.split('_').pop()!.toLowerCase().replace(/^./, c => c.toUpperCase()),
    party: w.party_id, margin: w.margin, status: 'WON', type: 'GEN' as const,
    color: '#fff', candidate: w.candidate_name, partyColor: '#fff', recentChange: false,
  }));
  return {
    election: { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', state_id: 4, state: { id: 4, name: 'Bihar', code: 'BR', total_assembly_seats: 243, total_ls_seats: 40 }, year: 2025, status: 'Finalized', tentative_next_date: null, manifest_url: null },
    data: {
      results: rows, manifestData: { alliances: [{ id: 'NDA', name: 'NDA', color: '#FF7A1A', parties: ['BJP', 'JDU'] }, { id: 'MGB', name: 'MGB', color: '#7BD34A', parties: ['RJD'] }] },
      standings: { groups: [], independents: [] }, constCandidates: cc, currentWinnerMap: winners,
      partyColorMap: new Map([['JDU', '#1FA37A'], ['BJP', '#FF7A1A'], ['RJD', '#7BD34A']]),
      partyNameMap: new Map([['JDU', 'Janata Dal (United)'], ['BJP', 'Bharatiya Janata Party'], ['RJD', 'Rashtriya Janata Dal']]),
      mapPartyList: [{ id: 'JDU', name: 'Janata Dal (United)', color: '#1FA37A', seats: 2 }, { id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 1 }, { id: 'RJD', name: 'Rashtriya Janata Dal', color: '#7BD34A', seats: 0 }],
      mapRegions, spoilerData: { spoilerSeats: new Set(), threeWaySeats: new Set(), hasData: true }, addableItems: [], voteShare: [],
      loading: false, error: null, modalConstId: null, setModalConstId: () => {}, mapTab: 'overview', setMapTab: () => {},
      userTracked: [], setUserTracked: () => {}, untrack: () => {}, spoilerFilter: null, setSpoilerFilter: () => {},
      refreshAll: () => {}, applyLiveUpdate: () => [],
    },
    swing: new Map(), dominance: new Map(), incumbency: [], partySwitches: [], marginTrend: [], prevYear: null,
    totalSeats: 243, majority: 122, votePct: new Map(), ticker: [], recentSeats: new Set(), sseConnected: false,
    availableLayers: ['overview', 'battle', 'demographics', 'insights'],
    ...over,
  };
}
```

`src/viewmodels/__tests__/tileVMs.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { useScoreboardVM } from '../tiles/useScoreboardVM';
import { useStandingsVM } from '../tiles/useStandingsVM';
import { useStatsVM } from '../tiles/useStatsVM';
import { useLayerInsightVM } from '../tiles/useLayerInsightVM';
import { makeSources } from './fixtures';

function wrap(sources = makeSources()) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/election/e1']}>
      <DashboardSourcesProvider value={sources}>
        <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={null}>{children}</DashboardStoreProvider>
      </DashboardSourcesProvider>
    </MemoryRouter>
  );
}

describe('tile view-models', () => {
  it('scoreboard: blocs from alliances, status final, focus intent', () => {
    const { result } = renderHook(() => ({ vm: useScoreboardVM(), store: useDashboardStore() }), { wrapper: wrap() });
    expect(result.current.vm.blocs.map(b => [b.id, b.seats])).toEqual([['NDA', 3], ['MGB', 0]]);
    expect(result.current.vm.status).toBe('final');
    act(() => result.current.vm.onFocus());
    expect(result.current.store.state.focus).toBe('scoreboard');
  });

  it('standings: locking a party highlights it', () => {
    const { result } = renderHook(() => ({ vm: useStandingsVM(), store: useDashboardStore() }), { wrapper: wrap() });
    expect(result.current.vm.rows.map(r => r.id)).toEqual(['JDU', 'BJP']);
    expect(result.current.vm.allRows).toHaveLength(3);
    act(() => result.current.vm.onLockParty('BJP'));
    expect(result.current.store.state.locked).toEqual({ chipId: 'party:BJP', highlight: { parties: ['BJP'], seats: [] } });
    expect(result.current.vm.lockedId).toBe('BJP');
  });

  it('stats: real closest / biggest from results', () => {
    const { result } = renderHook(() => useStatsVM(), { wrapper: wrap() });
    expect(result.current.stats.closest).toMatchObject({ id: 'BR_VS_1_SANDESH', margin: 27 });
    expect(result.current.stats.biggest).toMatchObject({ id: 'BR_VS_2_RUPAULI', margin: 73572 });
    expect(result.current.isLive).toBe(false);
  });

  it('layer insight follows the active layer', () => {
    const { result } = renderHook(() => ({ vm: useLayerInsightVM(), store: useDashboardStore() }), { wrapper: wrap() });
    expect(result.current.vm.insight?.headlineKey).toBe('studio_insight_overview');
    act(() => result.current.store.dispatch({ type: 'setLayer', layer: 'battle' }));
    expect(result.current.vm.insight?.headlineKey).toBe('studio_insight_battle');
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (modules missing).

- [ ] **Step 3: Implement the tile VMs**

`useScoreboardVM.ts`:
```ts
import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { deriveScoreboard, type Scoreboard, type ScoreBloc } from '../../model/derive/scoreboard';
import { deriveStandingRows, type StandingRow } from '../../model/derive/standings';

export type { Scoreboard, ScoreBloc };

export interface ScoreboardVM extends Scoreboard {
  status: 'final' | 'live' | 'upcoming';
  /** Pulse the tile once when live results changed a seat. */
  pulse: boolean;
  /** Member parties per bloc, for the expanded view. */
  breakdown: { id: string; name: string; color: string; rows: StandingRow[] }[];
  lockedId: string | null;
  onFocus(): void;
  onHoverBloc(id: string | null): void;
  onLockBloc(id: string): void;
}

export function useScoreboardVM(): ScoreboardVM {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const alliances = src.data.manifestData?.alliances ?? [];
  const board = useMemo(
    () => deriveScoreboard(alliances, src.data.mapPartyList, src.votePct, src.totalSeats, src.majority),
    [alliances, src.data.mapPartyList, src.votePct, src.totalSeats, src.majority],
  );
  const partiesOf = (id: string) => alliances.find(a => a.id === id)?.parties ?? [id];
  const status = src.election.status === 'Live' ? 'live' : src.election.status === 'Finalized' ? 'final' : 'upcoming';
  const breakdown = useMemo(() => {
    const rows = deriveStandingRows(src.data.mapPartyList, src.votePct, alliances, { includeZero: true });
    return board.blocs.map(b => ({ id: b.id, name: b.name, color: b.color, rows: b.kind === 'alliance' ? rows.filter(r => r.allianceId === b.id) : rows.filter(r => r.id === b.id) }));
  }, [board.blocs, src.data.mapPartyList, src.votePct, alliances]);
  return {
    ...board,
    status,
    pulse: src.recentSeats.size > 0,
    breakdown,
    lockedId: state.locked?.chipId.startsWith('bloc:') ? state.locked.chipId.slice(5) : null,
    onFocus: () => dispatch({ type: 'focus', tile: 'scoreboard' }),
    onHoverBloc: id => dispatch({ type: 'hover', highlight: id ? { parties: partiesOf(id), seats: [] } : null }),
    onLockBloc: id => dispatch({ type: 'toggleLock', chipId: `bloc:${id}`, highlight: { parties: partiesOf(id), seats: [] } }),
  };
}
```

`useStandingsVM.ts`:
```ts
import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { deriveStandingRows, type StandingRow } from '../../model/derive/standings';

export type { StandingRow };

export interface StandingsVM {
  rows: StandingRow[];
  allRows: StandingRow[];
  pulse: boolean;
  lockedId: string | null;
  onFocus(): void;
  onHoverParty(id: string | null): void;
  onLockParty(id: string): void;
}

export function useStandingsVM(): StandingsVM {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const alliances = src.data.manifestData?.alliances ?? [];
  const rows = useMemo(() => deriveStandingRows(src.data.mapPartyList, src.votePct, alliances), [src.data.mapPartyList, src.votePct, alliances]);
  const allRows = useMemo(() => deriveStandingRows(src.data.mapPartyList, src.votePct, alliances, { includeZero: true }), [src.data.mapPartyList, src.votePct, alliances]);
  return {
    rows,
    allRows,
    pulse: src.recentSeats.size > 0,
    lockedId: state.locked?.chipId.startsWith('party:') ? state.locked.chipId.slice(6) : null,
    onFocus: () => dispatch({ type: 'focus', tile: 'standings' }),
    onHoverParty: id => dispatch({ type: 'hover', highlight: id ? { parties: [id], seats: [] } : null }),
    onLockParty: id => dispatch({ type: 'toggleLock', chipId: `party:${id}`, highlight: { parties: [id], seats: [] } }),
  };
}
```

`useLayerInsightVM.ts`:
```ts
import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { deriveLayerInsight, type InsightChip, type LayerInsight } from '../../model/derive/layerInsights';
import type { LayerId } from '../../model/types/dashboard';
import type { MarginTrendPoint, PartySwitchEntry } from '../../model/types';

export type { InsightChip, LayerInsight };

export interface NetSwingRow { id: string; name: string; color: string; gained: number; lost: number }

export interface LayerInsightVM {
  layer: LayerId;
  insight: LayerInsight | null;
  lockedChipId: string | null;
  netSwing: NetSwingRow[];
  marginTrend: MarginTrendPoint[];
  partySwitches: PartySwitchEntry[];
  onFocus(): void;
  onHoverChip(c: InsightChip | null): void;
  onLockChip(c: InsightChip): void;
}

export function useLayerInsightVM(): LayerInsightVM {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const alliances = useMemo(() => src.data.manifestData?.alliances ?? [], [src.data.manifestData]);
  const insight = useMemo(() => deriveLayerInsight(state.layer, {
    electionType: src.election.type,
    seats: src.data.mapRegions,
    alliances,
    partyColor: src.data.partyColorMap,
    swing: src.swing,
    prevYear: src.prevYear,
    dominance: src.dominance,
    incumbency: src.incumbency,
    voteSplits: src.data.manifestData?.vote_splits,
    constCandidates: src.data.constCandidates,
    threeWaySeats: src.data.spoilerData.threeWaySeats,
  }), [state.layer, src, alliances]);

  const netSwing = useMemo((): NetSwingRow[] => {
    const al = new Map<string, { id: string; name: string; color: string }>();
    alliances.forEach(a => a.parties.forEach(p => al.set(p, a)));
    const rows = new Map<string, NetSwingRow>();
    const row = (party: string) => {
      const a = al.get(party);
      const id = a?.id ?? party;
      if (!rows.has(id)) rows.set(id, { id, name: a?.name ?? party, color: a?.color ?? src.data.partyColorMap.get(party) ?? '#8A93A6', gained: 0, lost: 0 });
      return rows.get(id)!;
    };
    for (const e of src.swing.values()) if (e.flipped) { row(e.currentParty).gained++; row(e.prevParty).lost++; }
    return [...rows.values()].sort((a, b) => (b.gained - b.lost) - (a.gained - a.lost));
  }, [src.swing, alliances, src.data.partyColorMap]);

  const highlightOf = (c: InsightChip) => ({ parties: [], seats: c.seatIds });
  return {
    layer: state.layer,
    insight,
    lockedChipId: state.locked?.chipId.startsWith('chip:') ? state.locked.chipId.slice(5) : null,
    netSwing,
    marginTrend: src.marginTrend,
    partySwitches: src.partySwitches,
    onFocus: () => dispatch({ type: 'focus', tile: 'insight' }),
    onHoverChip: c => dispatch({ type: 'hover', highlight: c ? highlightOf(c) : null }),
    onLockChip: c => dispatch({ type: 'toggleLock', chipId: `chip:${c.id}`, highlight: highlightOf(c) }),
  };
}
```

`useLeadersVM.ts`:
```ts
import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useLocalStorage } from '../data/useLocalStorage';
import { collectLeaderEntries, deriveLeaderCards, type CustomWatch, type LeaderCard } from '../../model/derive/leaders';

export type { LeaderCard };

export interface LeadersVM {
  cards: LeaderCard[];
  partyColor: Map<string, string>;
  seatOptions: { id: string; name: string }[];
  onFocus(): void;
  onSelectSeat(id: string): void;
  onHoverSeat(id: string | null): void;
  onAddCustom(constId: string): void;
  onRemoveCustom(constId: string): void;
}

export function useLeadersVM(): LeadersVM {
  const src = useSources();
  const { dispatch } = useDashboardStore();
  // Same storage key as the baseline WatchlistPanel, so users keep their watchlist.
  const [custom, setCustom] = useLocalStorage<CustomWatch[]>(`watchlist_${src.election.id}`, []);
  const cards = useMemo(
    () => deriveLeaderCards(collectLeaderEntries(src.data.manifestData, custom || []), src.data.currentWinnerMap),
    [src.data.manifestData, custom, src.data.currentWinnerMap],
  );
  const seatOptions = useMemo(() => src.data.mapRegions.map(r => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name)), [src.data.mapRegions]);
  return {
    cards,
    partyColor: src.data.partyColorMap,
    seatOptions,
    onFocus: () => dispatch({ type: 'focus', tile: 'leaders' }),
    onSelectSeat: id => dispatch({ type: 'selectSeat', seat: id }),
    onHoverSeat: id => dispatch({ type: 'hover', highlight: id ? { parties: [], seats: [id] } : null }),
    onAddCustom: constId => setCustom(prev => (prev || []).some(w => w.const_id === constId) ? prev || [] : [...(prev || []), { const_id: constId, label: seatOptions.find(s => s.id === constId)?.name ?? constId }]),
    onRemoveCustom: constId => setCustom(prev => (prev || []).filter(w => w.const_id !== constId)),
  };
}
```
(If `useLocalStorage`'s setter does not accept an updater function, read `src/viewmodels/data/useLocalStorage.ts` and pass the computed array instead — the baseline `WatchlistPanel` calls it with an updater, so it should.)

`useStatsVM.ts`:
```ts
import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { deriveStats, rankSeats, flippedSeatRefs, type DashboardStats, type SeatRef } from '../../model/derive/stats';
import type { TickerEvent } from '../../model/live/ticker';

export type { SeatRef, DashboardStats, TickerEvent };

export interface StatsVM {
  stats: DashboardStats;
  closest10: SeatRef[];
  biggest10: SeatRef[];
  flipped: SeatRef[];
  ticker: TickerEvent[];
  isLive: boolean;
  partyColor: Map<string, string>;
  onFocus(): void;
  onSelectSeat(id: string): void;
}

export function useStatsVM(): StatsVM {
  const src = useSources();
  const { dispatch } = useDashboardStore();
  const seats = src.data.mapRegions;
  return {
    stats: useMemo(() => deriveStats(seats, src.totalSeats, src.swing), [seats, src.totalSeats, src.swing]),
    closest10: useMemo(() => rankSeats(seats, 'closest', 10), [seats]),
    biggest10: useMemo(() => rankSeats(seats, 'biggest', 10), [seats]),
    flipped: useMemo(() => flippedSeatRefs(seats, src.swing), [seats, src.swing]),
    ticker: src.ticker,
    isLive: src.election.status === 'Live',
    partyColor: src.data.partyColorMap,
    onFocus: () => dispatch({ type: 'focus', tile: 'stats' }),
    onSelectSeat: id => dispatch({ type: 'selectSeat', seat: id }),
  };
}
```

`useSeatPanelVM.ts`:
```ts
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useApi } from '../data/useApi';
import { getConstituencyAnalysis } from '../../model/api/election.service';
import { displayNameFromConstId } from '../../model/geo/regionMatching';

export interface SeatPanelVM {
  seatId: string;
  name: string;
  candidates: { name: string; partyId: string; color: string; votes: number; status: string }[];
  margin: number | null;
  history: { classification: string; dominantParty: string | null } | null;
  briefing: string | null;
  fullPageHref: string;
  onClose(): void;
}

export function useSeatPanelVM(): SeatPanelVM | null {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const id = state.selectedSeat;
  // Hook runs every render (rules of hooks); it fetches only when a seat is selected.
  const { data: analysis } = useApi(() => (id ? getConstituencyAnalysis(src.election.id, id) : Promise.resolve(null)), [src.election.id, id]);
  if (!id) return null;
  const dom = src.dominance.get(id);
  const rows = src.data.constCandidates.get(id) ?? [];
  const winner = src.data.currentWinnerMap.get(id);
  return {
    seatId: id,
    name: displayNameFromConstId(id),
    candidates: rows.map(r => ({ name: r.candidate_name, partyId: r.party_id, color: src.data.partyColorMap.get(r.party_id) ?? '#8A93A6', votes: r.votes, status: r.status })),
    margin: winner ? Number(winner.margin) || 0 : null,
    history: dom ? { classification: dom.classification, dominantParty: dom.dominantParty ?? null } : null,
    briefing: (analysis as { ai_briefing?: string | null } | null)?.ai_briefing ?? null,
    fullPageHref: `/election/${src.election.id}/constituency/${id}`,
    onClose: () => dispatch({ type: 'selectSeat', seat: null }),
  };
}
```

`useTopBarVM.ts` (election switching ported from baseline `Header.tsx` lines 24–110):
```ts
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../data/useApi';
import { useElection } from '../data/useElection';
import { getElections } from '../../model/api/election.service';
import { getStates } from '../../model/api/geo.service';
import type { Election } from '../../model/types';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { countDeclared } from '../../model/derive/marginStats';

const LANGS = ['en', 'hi', 'ta', 'mr'];

function remember(type: 'LS' | 'VS', id: string | null) {
  try { if (id) localStorage.setItem(`lastElection_${type}`, id); else localStorage.removeItem(`lastElection_${type}`); } catch { /* best effort */ }
}
function recall(type: 'LS' | 'VS', elections: Election[]): Election | null {
  let id: string | null = null;
  try { id = localStorage.getItem(`lastElection_${type}`); } catch { id = null; }
  return elections.find(e => e.id === id && e.type === type) ?? null;
}

export interface TopBarVM {
  electionType: 'LS' | 'VS';
  electionId: string;
  states: { id: number; name: string }[];
  stateId: number | null;
  years: { id: string; year: number }[];
  lsElections: { id: string; name: string }[];
  statusLabel: { kind: 'final' | 'live' | 'upcoming'; declared: number; total: number };
  shareText: string;
  lang: string;
  langs: string[];
  onType(t: 'LS' | 'VS'): void;
  onState(id: number): void;
  onElection(id: string): void;
  onLang(l: string): void;
  onSearchSeat(id: string): void;
}

export function useTopBarVM(): TopBarVM {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const src = useSources();
  const { dispatch } = useDashboardStore();
  const { setElection, setElectionType, setSelectedStateId } = useElection();
  const { data: elections } = useApi(() => getElections(), []);
  const { data: states } = useApi(() => getStates(), []);
  const all = useMemo(() => elections ?? [], [elections]);
  const current = src.election;

  const go = useCallback((el: Election | null, type: 'LS' | 'VS') => {
    setElection(el);
    setElectionType(type);
    remember(type, el?.id ?? null);
    if (el?.state_id) setSelectedStateId(el.state_id);
    navigate(el ? `/election/${el.id}` : '/');
  }, [navigate, setElection, setElectionType, setSelectedStateId]);

  const vsStates = useMemo(() => {
    const ids = new Set(all.filter(e => e.type === 'VS' && e.state_id != null).map(e => e.state_id!));
    return (states ?? []).filter(s => ids.has(s.id)).map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, states]);

  const years = useMemo(() => all.filter(e => e.type === 'VS' && e.state_id === current.state_id).sort((a, b) => b.year - a.year).map(e => ({ id: e.id, year: e.year })), [all, current.state_id]);
  const lsElections = useMemo(() => all.filter(e => e.type === 'LS').sort((a, b) => b.year - a.year).map(e => ({ id: e.id, name: e.name })), [all]);

  return {
    electionType: current.type,
    electionId: current.id,
    states: vsStates,
    stateId: current.state_id,
    years,
    lsElections,
    statusLabel: {
      kind: current.status === 'Live' ? 'live' : current.status === 'Finalized' ? 'final' : 'upcoming',
      declared: countDeclared(src.data.mapRegions),
      total: src.totalSeats,
    },
    shareText: `${current.name} - Election Tracker`,
    lang: i18n.language,
    langs: LANGS,
    onType: t => { if (t !== current.type) go(recall(t, all) ?? all.find(e => e.type === t) ?? null, t); },
    onState: id => go(all.filter(e => e.type === 'VS' && e.state_id === id).sort((a, b) => b.year - a.year)[0] ?? null, 'VS'),
    onElection: id => { const el = all.find(e => e.id === id) ?? null; go(el, el?.type ?? current.type); },
    onLang: l => { void i18n.changeLanguage(l); },
    onSearchSeat: id => dispatch({ type: 'selectSeat', seat: id }),
  };
}
```

- [ ] **Step 4: Run to verify they pass** — `npx vitest run src/viewmodels && npx tsc --noEmit && npm run lint` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viewmodels/tiles src/viewmodels/__tests__
git commit -m "Add tile view-models"
```

---

### Task 13: Views — UI primitives, Tile shell and Focus overlay

**Files:**
- Create: `src/views/ui/FocusDialog.tsx`, `src/views/ui/PillToggle.tsx`, `src/views/ui/PickerSelect.tsx`, `src/views/hooks/useElementHeight.ts`, `src/views/hooks/useMediaQuery.ts`, `src/views/dashboard/Tile.tsx`, `src/views/dashboard/FocusOverlay.tsx`
- Modify: `src/i18n/locales/{en,hi,ta,mr}.json`, `src/__tests__/i18n.test.ts`
- Test: `src/views/__tests__/focus.test.tsx`

**Interfaces:**
- Produces:
```tsx
export function FocusDialog(props: { open: boolean; title: string; onClose(): void; children: ReactNode }): JSX.Element
export function PillToggle<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange(v: T): void; ariaLabel: string; size?: 'sm' | 'md' }): JSX.Element
export function PickerSelect(props: { value: string; options: { value: string; label: string }[]; onChange(v: string): void; ariaLabel: string; placeholder?: string }): JSX.Element
export function useElementHeight<T extends HTMLElement>(): [RefCallback<T>, number]
export function useMediaQuery(query: string): boolean
export function Tile(props: { title: string; onExpand?(): void; actions?: ReactNode; className?: string; bodyClassName?: string; pulse?: boolean; children: ReactNode }): JSX.Element
export function FocusOverlay(props: { tile: FocusTile | null; titles: Record<FocusTile, string>; onClose(): void; render(tile: FocusTile): ReactNode }): JSX.Element
```

- [ ] **Step 1: Write the failing focus test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n';
import { Tile } from '../dashboard/Tile';
import { FocusOverlay } from '../dashboard/FocusOverlay';

const titles = { map: 'Map', scoreboard: 'Results', standings: 'Standings', insight: 'Insight', leaders: 'Leaders', stats: 'Stats' };

describe('Tile + FocusOverlay', () => {
  it('tile expand button calls onExpand', () => {
    const onExpand = vi.fn();
    render(<Tile title="Party standings" onExpand={onExpand}>x</Tile>);
    fireEvent.click(screen.getByRole('button', { name: /expand party standings/i }));
    expect(onExpand).toHaveBeenCalled();
  });
  it('overlay renders the focused tile and closes on Escape', () => {
    const onClose = vi.fn();
    render(<FocusOverlay tile="standings" titles={titles} onClose={onClose} render={t => <p>content {t}</p>} />);
    expect(screen.getByText('content standings')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('renders nothing when no tile is focused', () => {
    const { container } = render(<FocusOverlay tile={null} titles={titles} onClose={() => {}} render={() => 'x'} />);
    expect(container.textContent).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 2b: Add all studio i18n keys to the four locales** (every view from here on calls `t()`, and view tests load the real `en` resources)

Add to `en.json` (and the translated values below to `hi.json`, `ta.json`, `mr.json`):

| key | en | hi | ta | mr |
|---|---|---|---|---|
| studio_close | Close | बंद करें | மூடு | बंद करा |
| studio_expand | Expand {{name}} | {{name}} बड़ा करें | {{name}} விரிவாக்கு | {{name}} मोठे करा |
| studio_results | Assembly results | परिणाम | முடிவுகள் | निकाल |
| studio_votes_pct | {{pct}}% votes | {{pct}}% वोट | {{pct}}% வாக்குகள் | {{pct}}% मते |
| studio_to_win | {{count}} to win | जीत के लिए {{count}} | வெற்றிக்கு {{count}} | विजयासाठी {{count}} |
| studio_wins_by | {{name}} crosses the majority by {{count}} seats | {{name}} बहुमत से {{count}} सीटें आगे | {{name}} பெரும்பான்மையை {{count}} இடங்களால் கடந்தது | {{name}} बहुमतापेक्षा {{count}} जागांनी पुढे |
| studio_no_results_yet | No results yet | अभी कोई परिणाम नहीं | இன்னும் முடிவுகள் இல்லை | अद्याप निकाल नाहीत |
| studio_more_parties | +{{count}} more parties · {{seats}} seats | +{{count}} और दल · {{seats}} सीटें | +{{count}} மேலும் கட்சிகள் · {{seats}} இடங்கள் | +{{count}} आणखी पक्ष · {{seats}} जागा |
| studio_no_layer_data | No data for this layer | इस परत के लिए डेटा नहीं | இந்த அடுக்குக்கு தரவு இல்லை | या स्तरासाठी माहिती नाही |
| studio_insight_overview | {{text}} | {{text}} | {{text}} | {{text}} |
| studio_insight_battle | Median margin {{median}} · {{close}} seats won by < {{threshold}} | मध्य अंतर {{median}} · {{close}} सीटें {{threshold}} से कम अंतर से | நடு வித்தியாசம் {{median}} · {{close}} இடங்கள் {{threshold}}க்குக் குறைவாக | मध्य फरक {{median}} · {{close}} जागा {{threshold}} पेक्षा कमी फरकाने |
| studio_insight_swing | {{flipped}} of {{total}} seats changed hands vs {{year}} | {{year}} की तुलना में {{total}} में से {{flipped}} सीटें बदलीं | {{year}} உடன் ஒப்பிட {{total}}ல் {{flipped}} இடங்கள் மாறின | {{year}} च्या तुलनेत {{total}} पैकी {{flipped}} जागा बदलल्या |
| studio_insight_history | {{strongholds}} strongholds · {{swing}} swing seats | {{strongholds}} गढ़ · {{swing}} स्विंग सीटें | {{strongholds}} கோட்டைகள் · {{swing}} மாறும் இடங்கள் | {{strongholds}} बालेकिल्ले · {{swing}} स्विंग जागा |
| studio_insight_reserved | SC {{sc}} · ST {{st}} reserved seats | अनुसूचित जाति {{sc}} · अनुसूचित जनजाति {{st}} आरक्षित सीटें | SC {{sc}} · ST {{st}} ஒதுக்கீட்டு இடங்கள் | SC {{sc}} · ST {{st}} राखीव जागा |
| studio_insight_spoilers | {{count}} seats where a third party exceeded the margin | {{count}} सीटें जहां तीसरे दल के वोट अंतर से ज़्यादा | {{count}} இடங்களில் மூன்றாம் கட்சி வித்தியாசத்தை மீறியது | {{count}} जागांवर तिसऱ्या पक्षाची मते फरकापेक्षा जास्त |
| studio_insight_threeway | {{count}} three-way contests | {{count}} त्रिकोणीय मुकाबले | {{count}} மும்முனைப் போட்டிகள் | {{count}} तिरंगी लढती |
| studio_insight_states | {{states}} states | {{states}} राज्य | {{states}} மாநிலங்கள் | {{states}} राज्ये |
| studio_chip_stronghold | Strongholds | गढ़ | கோட்டைகள் | बालेकिल्ले |
| studio_chip_loyal | Loyal | वफ़ादार | விசுவாசம் | निष्ठावान |
| studio_chip_swing | Swing | स्विंग | மாறும் | स्विंग |
| studio_chip_anti_incumbency | Incumbents lost | मौजूदा हारे | பதவியில் இருந்தோர் தோற்றனர் | विद्यमान पराभूत |
| studio_key_leaders | Key leaders | प्रमुख नेता | முக்கிய தலைவர்கள் | प्रमुख नेते |
| studio_no_leaders | No leaders configured | कोई नेता तय नहीं | தலைவர்கள் அமைக்கப்படவில்லை | नेते निश्चित नाहीत |
| studio_status_won | Won | जीते | வென்றார் | विजयी |
| studio_status_leading | Leading | आगे | முன்னிலை | आघाडीवर |
| studio_status_lost | Lost | हारे | தோற்றார் | पराभूत |
| studio_status_trailing | Trailing | पीछे | பின்னிலை | पिछाडीवर |
| studio_status_pending | Pending | बाकी | நிலுவையில் | प्रलंबित |
| studio_add_seat | Add a seat to watch | देखने के लिए सीट जोड़ें | கவனிக்க இடம் சேர் | पाहण्यासाठी जागा जोडा |
| studio_add | Add | जोड़ें | சேர் | जोडा |
| studio_remove | Remove | हटाएं | நீக்கு | काढा |
| studio_declared | Declared | घोषित | அறிவிக்கப்பட்டது | घोषित |
| studio_closest_contest | Closest contest | सबसे कड़ा मुकाबला | நெருக்கமான போட்டி | सर्वात चुरशीची लढत |
| studio_biggest_win | Biggest win | सबसे बड़ी जीत | பெரிய வெற்றி | सर्वात मोठा विजय |
| studio_seats_flipped | Seats flipped | बदली सीटें | மாறிய இடங்கள் | बदललेल्या जागा |
| studio_closest_contests | Closest contests | सबसे कड़े मुकाबले | நெருக்கமான போட்டிகள் | चुरशीच्या लढती |
| studio_biggest_wins | Biggest wins | सबसे बड़ी जीतें | பெரிய வெற்றிகள் | मोठे विजय |
| studio_live_feed | Live feed | लाइव फ़ीड | நேரலை | थेट फीड |
| studio_live | Live | लाइव | நேரலை | थेट |
| studio_latest | Latest | ताज़ा | சமீபத்திய | ताजे |
| studio_stats | Election stats | चुनाव आंकड़े | தேர்தல் புள்ளிவிவரம் | निवडणूक आकडे |
| studio_ticker_won | {{party}} wins {{seat}} | {{party}} ने {{seat}} जीती | {{party}} {{seat}} வென்றது | {{party}} ने {{seat}} जिंकली |
| studio_ticker_lead | {{party}} leads in {{seat}} | {{party}} {{seat}} में आगे | {{party}} {{seat}}ல் முன்னிலை | {{party}} {{seat}} मध्ये आघाडीवर |
| studio_ticker_waiting | Waiting for updates | अपडेट की प्रतीक्षा | புதுப்பிப்புக்காக காத்திருக்கிறது | अपडेटची प्रतीक्षा |
| studio_ticker_all_declared | All {{count}} results declared | सभी {{count}} परिणाम घोषित | அனைத்து {{count}} முடிவுகளும் அறிவிக்கப்பட்டன | सर्व {{count}} निकाल जाहीर |
| studio_map_layers | Map layers | मानचित्र परतें | வரைபட அடுக்குகள் | नकाशा स्तर |
| studio_map_mode | Map style | मानचित्र शैली | வரைபட வகை | नकाशा प्रकार |
| studio_map | Map | मानचित्र | வரைபடம் | नकाशा |
| studio_hex | Hex | हेक्स | அறுகோணம் | हेक्स |
| studio_clear_highlight | Clear highlight | हाइलाइट हटाएं | சிறப்பு நீக்கு | हायलाइट काढा |
| studio_pick_seat | Click a constituency to see its result | परिणाम देखने के लिए निर्वाचन क्षेत्र चुनें | முடிவைப் பார்க்க தொகுதியைத் தேர்ந்தெடு | निकाल पाहण्यासाठी मतदारसंघ निवडा |
| studio_margin | Margin {{count}} | अंतर {{count}} | வித்தியாசம் {{count}} | फरक {{count}} |
| studio_election_type | Election type | चुनाव प्रकार | தேர்தல் வகை | निवडणूक प्रकार |
| studio_year | Year | वर्ष | ஆண்டு | वर्ष |
| studio_language | Language | भाषा | மொழி | भाषा |
| studio_avg_margin | Average margin | औसत अंतर | சராசரி வித்தியாசம் | सरासरी फरक |
| studio_median_margin | Median margin | मध्य अंतर | நடு வித்தியாசம் | मध्य फरक |
| studio_party_switchers | {{count}} candidates switched party | {{count}} उम्मीदवारों ने दल बदला | {{count}} வேட்பாளர்கள் கட்சி மாறினர் | {{count}} उमेदवारांनी पक्ष बदलला |
| studio_share_whatsapp | WhatsApp | व्हाट्सऐप | வாட்ஸ்அப் | व्हॉट्सअ‍ॅप |
| studio_share_x | X | X | X | X |
| studio_status_label_final | Final result · {{declared}}/{{total}} declared | अंतिम परिणाम · {{declared}}/{{total}} घोषित | இறுதி முடிவு · {{declared}}/{{total}} | अंतिम निकाल · {{declared}}/{{total}} जाहीर |
| studio_status_label_live | Live · {{declared}}/{{total}} declared | लाइव · {{declared}}/{{total}} घोषित | நேரலை · {{declared}}/{{total}} | थेट · {{declared}}/{{total}} जाहीर |
| studio_status_label_upcoming | Upcoming | आगामी | வரவிருக்கும் | आगामी |

Existing keys reused (already in all locales): `others`, `party_standings`, `constituency_map`, `map_tab_*`, `loading_map`, `map_load_failed`, `results_pending`, `view_full_page`, `search`, `search_placeholder`, `constituency`, `candidates`, `app_title`, `lok_sabha`, `vidhan_sabha`, `select_state`, `select_election`, `select_election_prompt`, `failed_to_load_election`, `retry`, `won`, `leading`. If any of these is missing from `en.json` (the i18n test will say), add it to all four files.

In `src/__tests__/i18n.test.ts`, inside `usedKeys()`, add the keys chosen through variables:
```ts
  for (const k of ['overview', 'battle', 'swing', 'history', 'reserved', 'spoilers', 'threeway', 'states']) keys.add(`studio_insight_${k}`);
  for (const k of ['stronghold', 'loyal', 'swing', 'anti_incumbency']) keys.add(`studio_chip_${k}`);
  for (const k of ['won', 'leading', 'lost', 'trailing', 'pending']) keys.add(`studio_status_${k}`);
  for (const k of ['final', 'live', 'upcoming']) keys.add(`studio_status_label_${k}`);
```

- [ ] **Step 3: Implement**

`src/views/ui/FocusDialog.tsx`:
```tsx
import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function FocusDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose(): void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-page/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="studio-root studio-focus fixed left-1/2 top-1/2 z-50 flex h-[88vh] w-[90vw] max-w-[1400px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-tile border border-line bg-tile shadow-2xl outline-none max-lg:h-dvh max-lg:w-screen max-lg:rounded-none"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <Dialog.Title className="font-display text-xl font-bold uppercase tracking-wide text-ink">{title}</Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-tile-raised hover:text-ink" aria-label={t('studio_close')}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" /></svg>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

`src/views/ui/PillToggle.tsx`:
```tsx
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from './cn';

export function PillToggle<T extends string>({ value, options, onChange, ariaLabel, size = 'md' }: {
  value: T; options: { value: T; label: string }[]; onChange(v: T): void; ariaLabel: string; size?: 'sm' | 'md';
}) {
  return (
    <ToggleGroup.Root type="single" value={value} onValueChange={v => { if (v) onChange(v as T); }} aria-label={ariaLabel}
      className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-page/60 p-0.5 [scrollbar-width:none]">
      {options.map(o => (
        <ToggleGroup.Item key={o.value} value={o.value}
          className={cn('shrink-0 rounded-full font-medium text-muted transition-colors hover:text-ink data-[state=on]:bg-accent data-[state=on]:text-page',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm')}>
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
```

`src/views/ui/PickerSelect.tsx`:
```tsx
import * as Select from '@radix-ui/react-select';

export function PickerSelect({ value, options, onChange, ariaLabel, placeholder }: {
  value: string; options: { value: string; label: string }[]; onChange(v: string): void; ariaLabel: string; placeholder?: string;
}) {
  return (
    <Select.Root value={value || undefined} onValueChange={onChange}>
      <Select.Trigger aria-label={ariaLabel} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-page/60 px-3 text-sm font-medium text-ink hover:border-accent">
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-muted">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="studio-root z-50 max-h-80 overflow-hidden rounded-xl border border-line bg-tile shadow-2xl">
          <Select.Viewport className="p-1">
            {options.map(o => (
              <Select.Item key={o.value} value={o.value} className="cursor-pointer select-none rounded-lg px-3 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-tile-raised data-[state=checked]:text-accent">
                <Select.ItemText>{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
```

`src/views/hooks/useElementHeight.ts`:
```ts
import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

/** Live height of an element (ResizeObserver). Views use it to decide how many rows fit. */
export function useElementHeight<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    if (!el) return;
    setHeight(el.clientHeight);
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.current.observe(el);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, height];
}
```

`src/views/hooks/useMediaQuery.ts`:
```ts
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
```

`src/views/dashboard/Tile.tsx`:
```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/cn';

export function Tile({ title, onExpand, actions, className, bodyClassName, pulse, children }: {
  title: string; onExpand?(): void; actions?: ReactNode; className?: string; bodyClassName?: string; pulse?: boolean; children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-tile border border-line bg-tile', pulse && 'studio-pulse', className)}>
      <header className="flex h-11 shrink-0 items-center gap-3 px-4">
        <h2 className="truncate font-display text-base font-bold uppercase tracking-wider text-ink">{title}</h2>
        <div className="ml-auto flex min-w-0 items-center gap-2">{actions}</div>
        {onExpand && (
          <button type="button" onClick={onExpand} aria-label={t('studio_expand', { name: title })}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-tile-raised hover:text-accent">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" /></svg>
          </button>
        )}
      </header>
      <div className={cn('min-h-0 flex-1 overflow-hidden px-4 pb-3', bodyClassName)}>{children}</div>
    </section>
  );
}
```

`src/views/dashboard/FocusOverlay.tsx`:
```tsx
import type { ReactNode } from 'react';
import type { FocusTile } from '../../viewmodels/store/dashboardStore';
import { FocusDialog } from '../ui/FocusDialog';

export function FocusOverlay({ tile, titles, onClose, render }: {
  tile: FocusTile | null; titles: Record<FocusTile, string>; onClose(): void; render(tile: FocusTile): ReactNode;
}) {
  if (!tile) return null;
  return <FocusDialog open title={titles[tile]} onClose={onClose}>{render(tile)}</FocusDialog>;
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/views && npx tsc --noEmit && npm run lint` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views src/i18n src/__tests__/i18n.test.ts
git commit -m "Add UI primitives, Tile shell, focus overlay and studio translations"
```

---

### Task 14: Views — scoreboard, standings, insight, leaders, stats tiles

**Files:**
- Create: `src/views/dashboard/{ScoreboardTile,StandingsTile,LayerInsightStrip,LeadersStrip,StatsStrip}.tsx`
- Test: `src/views/__tests__/tiles.test.tsx`

**Interfaces:**
- Consumes: VM types and re-exported model types from Task 12 (views import them from `viewmodels/tiles/*`, never from `model/derive`); `Tile` (Task 13).
- Fit math: how many rows fit depends on measured height, which only the view knows, while the counting logic is model code. Views therefore get `fitCount`/`compactList` through a view-model re-export (`src/viewmodels/tiles/fit.ts`), used by the view hook `useFitRows` — no logic is duplicated and the lint boundary holds.
- Produces:
```tsx
export function ScoreboardTile(props: { vm: ScoreboardVM; variant: 'tile' | 'focus' | 'compact' }): JSX.Element
export function StandingsTile(props: { vm: StandingsVM; variant: 'tile' | 'focus' }): JSX.Element
export function LayerInsightStrip(props: { vm: LayerInsightVM; variant: 'tile' | 'focus' }): JSX.Element
export function LeadersStrip(props: { vm: LeadersVM; variant: 'tile' | 'focus' }): JSX.Element
export function StatsStrip(props: { vm: StatsVM; variant: 'tile' | 'focus' }): JSX.Element
export function useFitRows<T extends { seats: number }>(rows: T[], rowHeight: number, gap?: number, footer?: number): { ref: RefCallback<HTMLDivElement>; visible: T[]; moreCount: number; moreSeats: number }
```

- [ ] **Step 1: Write the failing view tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n';
import { ScoreboardTile } from '../dashboard/ScoreboardTile';
import { StandingsTile } from '../dashboard/StandingsTile';
import { StatsStrip } from '../dashboard/StatsStrip';
import type { ScoreboardVM } from '../../viewmodels/tiles/useScoreboardVM';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';
import type { StatsVM } from '../../viewmodels/tiles/useStatsVM';

const noop = () => {};
const board: ScoreboardVM = {
  blocs: [{ id: 'NDA', name: 'NDA', color: '#FF7A1A', seats: 202, votePct: 48.1, kind: 'alliance' }, { id: 'MGB', name: 'MGB', color: '#7BD34A', seats: 34, votePct: 37.1, kind: 'alliance' }],
  others: { seats: 7, votePct: 14.8 }, totalSeats: 243, majority: 122, countedSeats: 243, winnerId: 'NDA', marginOverMajority: 80,
  status: 'final', pulse: false, breakdown: [], lockedId: null, onFocus: noop, onHoverBloc: noop, onLockBloc: noop,
};

describe('dashboard tiles', () => {
  it('scoreboard shows real seat numbers and the majority marker', () => {
    render(<ScoreboardTile vm={board} variant="tile" />);
    expect(screen.getByText('202')).toBeTruthy();
    expect(screen.getByText('34')).toBeTruthy();
    expect(screen.getByText(/122/)).toBeTruthy();
  });

  it('standings rows lock a party on click', () => {
    const onLockParty = vi.fn();
    const vm: StandingsVM = { rows: [{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 89, votePct: null, allianceId: 'NDA' }], allRows: [], pulse: false, lockedId: null, onFocus: noop, onHoverParty: noop, onLockParty };
    render(<StandingsTile vm={vm} variant="tile" />);
    fireEvent.click(screen.getByRole('button', { name: /BJP/ }));
    expect(onLockParty).toHaveBeenCalledWith('BJP');
  });

  it('stats show a dash when nothing is declared', () => {
    const vm: StatsVM = { stats: { declared: 0, total: 243, closest: null, biggest: null, flipped: null }, closest10: [], biggest10: [], flipped: [], ticker: [], isLive: true, partyColor: new Map(), onFocus: noop, onSelectSeat: noop };
    render(<StatsStrip vm={vm} variant="tile" />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement the fit re-export and hook**

`src/viewmodels/tiles/fit.ts`:
```ts
export { fitCount } from '../../model/derive/fit';
export { compactList } from '../../model/derive/standings';
```

`src/views/hooks/useFitRows.ts`:
```ts
import { useMemo, type RefCallback } from 'react';
import { fitCount, compactList } from '../../viewmodels/tiles/fit';
import { useElementHeight } from './useElementHeight';

export function useFitRows<T extends { seats: number }>(rows: T[], rowHeight: number, gap = 4, footer = 22) {
  const [ref, height] = useElementHeight<HTMLDivElement>();
  const list = useMemo(() => {
    const { count } = fitCount({ available: height, itemHeight: rowHeight, gap, footerHeight: footer, total: rows.length });
    return compactList(rows, count);
  }, [rows, height, rowHeight, gap, footer]);
  return { ref: ref as RefCallback<HTMLDivElement>, ...list };
}
```

- [ ] **Step 4: Implement the tiles**

`ScoreboardTile.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import type { ScoreboardVM } from '../../viewmodels/tiles/useScoreboardVM';
import { Tile } from './Tile';
import { cn } from '../ui/cn';

export function ScoreboardTile({ vm, variant }: { vm: ScoreboardVM; variant: 'tile' | 'focus' | 'compact' }) {
  const { t } = useTranslation();
  const total = Math.max(vm.totalSeats, 1);
  const body = (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="flex items-end gap-4">
        {vm.blocs.map((b, i) => (
          <button key={b.id} type="button" onClick={() => vm.onLockBloc(b.id)} onMouseEnter={() => vm.onHoverBloc(b.id)} onMouseLeave={() => vm.onHoverBloc(null)}
            aria-label={`${b.name} ${b.seats}`} aria-pressed={vm.lockedId === b.id}
            className={cn('flex min-w-0 items-end gap-3 rounded-xl px-1 text-left', i > 0 && 'border-l border-line pl-4', vm.lockedId === b.id && 'ring-2 ring-accent')}>
            <div className="min-w-0 pb-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: b.color }}>
                <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />{b.name}
              </div>
              {b.votePct != null && <div className="text-xs text-muted">{t('studio_votes_pct', { pct: b.votePct })}</div>}
            </div>
            <span className={cn('tabular font-display font-extrabold leading-none', variant === 'compact' ? 'text-5xl' : 'text-[88px]')} style={{ color: b.color }}>{b.seats}</span>
          </button>
        ))}
        <div className="ml-auto pb-2 text-right">
          <div className="text-xs text-muted">{t('others')}</div>
          <div className="tabular font-display text-3xl font-bold text-muted">{vm.others.seats}</div>
        </div>
      </div>
      <div className="relative">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-page">
          {vm.blocs.map(b => <div key={b.id} style={{ width: `${(b.seats / total) * 100}%`, background: b.color }} />)}
          <div style={{ width: `${(vm.others.seats / total) * 100}%` }} className="bg-muted/60" />
        </div>
        <div className="absolute -top-1.5 h-5 w-0.5 bg-ink" style={{ left: `${(vm.majority / total) * 100}%` }} aria-hidden />
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>0</span>
          <span className="font-semibold text-ink">{t('studio_to_win', { count: vm.majority })}</span>
          <span>{vm.totalSeats}</span>
        </div>
      </div>
      {variant === 'focus' && vm.winnerId && vm.marginOverMajority != null && (
        <p className="text-sm text-muted">{t('studio_wins_by', { name: vm.blocs[0].name, count: vm.marginOverMajority })}</p>
      )}
    </div>
  );
  if (variant === 'focus') {
    return (
      <div className="flex flex-col gap-6">
        {body}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {vm.breakdown.map(b => (
            <div key={b.id} className="rounded-xl border border-line p-3">
              <div className="mb-2 font-display text-lg font-bold" style={{ color: b.color }}>{b.name}</div>
              <table className="w-full text-sm"><tbody>
                {b.rows.map(r => (
                  <tr key={r.id} className="border-b border-line"><td className="py-1"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />{r.id} <span className="text-muted">{r.name}</span></td>
                    <td className="tabular text-right text-muted">{r.votePct != null ? `${r.votePct}%` : '—'}</td><td className="tabular w-12 text-right font-semibold">{r.seats}</td></tr>
                ))}
              </tbody></table>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <Tile title={t('studio_results')} onExpand={vm.onFocus} pulse={vm.pulse}>{body}</Tile>;
}
```

`StandingsTile.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import type { StandingsVM, StandingRow } from '../../viewmodels/tiles/useStandingsVM';
import { Tile } from './Tile';
import { useFitRows } from '../hooks/useFitRows';
import { cn } from '../ui/cn';

const ROW_H = 36;

function Row({ r, max, vm, wide }: { r: StandingRow; max: number; vm: StandingsVM; wide?: boolean }) {
  return (
    <button type="button" onClick={() => vm.onLockParty(r.id)} onMouseEnter={() => vm.onHoverParty(r.id)} onMouseLeave={() => vm.onHoverParty(null)}
      aria-pressed={vm.lockedId === r.id} aria-label={`${r.id} ${r.name} ${r.seats}`}
      className={cn('grid h-9 w-full grid-cols-[minmax(0,1fr)_minmax(60px,40%)_48px] items-center gap-3 rounded-lg px-2 text-left hover:bg-tile-raised', vm.lockedId === r.id && 'bg-tile-raised ring-1 ring-accent', wide && 'grid-cols-[minmax(0,1fr)_minmax(80px,40%)_64px_64px]')}>
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
        <span className="font-semibold text-ink">{r.id}</span>
        <span className="truncate text-xs text-muted">{r.name}</span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-page"><span className="block h-full rounded-full" style={{ width: `${(r.seats / max) * 100}%`, background: r.color }} /></span>
      {wide && <span className="tabular text-right text-sm text-muted">{r.votePct != null ? `${r.votePct}%` : '—'}</span>}
      <span className="tabular text-right font-display text-2xl font-bold text-ink">{r.seats}</span>
    </button>
  );
}

export function StandingsTile({ vm, variant }: { vm: StandingsVM; variant: 'tile' | 'focus' }) {
  const { t } = useTranslation();
  const fit = useFitRows(vm.rows, ROW_H);
  if (variant === 'focus') {
    const max = Math.max(1, ...vm.allRows.map(r => r.seats));
    return <div className="flex flex-col gap-1">{vm.allRows.map(r => <Row key={r.id} r={r} max={max} vm={vm} wide />)}</div>;
  }
  const max = Math.max(1, ...vm.rows.map(r => r.seats));
  return (
    <Tile title={t('party_standings')} onExpand={vm.onFocus} pulse={vm.pulse}>
      <div ref={fit.ref} className="flex h-full flex-col gap-1">
        {vm.rows.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('studio_no_results_yet')}</p>}
        {fit.visible.map(r => <Row key={r.id} r={r} max={max} vm={vm} />)}
        {fit.moreCount > 0 && (
          <button type="button" onClick={vm.onFocus} className="mt-auto px-2 text-left text-xs text-muted hover:text-accent">
            {t('studio_more_parties', { count: fit.moreCount, seats: fit.moreSeats })}
          </button>
        )}
      </div>
    </Tile>
  );
}
```

`LayerInsightStrip.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import type { LayerInsightVM, InsightChip } from '../../viewmodels/tiles/useLayerInsightVM';
import { cn } from '../ui/cn';

function Chip({ c, vm }: { c: InsightChip; vm: LayerInsightVM }) {
  const { t } = useTranslation();
  const label = c.labelKey ? t(c.labelKey) : c.label;
  return (
    <button type="button" onClick={() => vm.onLockChip(c)} onMouseEnter={() => vm.onHoverChip(c)} onMouseLeave={() => vm.onHoverChip(null)}
      aria-pressed={vm.lockedChipId === c.id}
      className={cn('inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-line bg-page/60 px-3 text-sm hover:border-accent', vm.lockedChipId === c.id && 'border-accent bg-tile-raised')}>
      {c.fromColor && <span className="h-2 w-2 rounded-full" style={{ background: c.fromColor }} />}
      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
      <span className="font-medium text-ink">{label}</span>
      <span className="tabular font-display text-lg font-bold text-ink">{c.count}</span>
    </button>
  );
}

export function LayerInsightStrip({ vm, variant }: { vm: LayerInsightVM; variant: 'tile' | 'focus' }) {
  const { t } = useTranslation();
  if (!vm.insight) return variant === 'tile' ? <div className="rounded-tile border border-line bg-tile px-4 py-3 text-sm text-muted">{t('studio_no_layer_data')}</div> : null;
  const headline = t(vm.insight.headlineKey, vm.insight.headlineParams);
  if (variant === 'focus') {
    return (
      <div className="flex flex-col gap-5">
        <p className="font-display text-2xl font-bold text-ink">{headline}</p>
        <div className="flex flex-wrap gap-2">{vm.insight.chips.map(c => <Chip key={c.id} c={c} vm={vm} />)}</div>
        {vm.layer === 'swing' && vm.netSwing.length > 0 && (
          <table className="w-full max-w-xl text-sm"><tbody>
            {vm.netSwing.map(r => (
              <tr key={r.id} className="border-b border-line"><td className="py-1.5"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />{r.name}</td>
                <td className="tabular text-right text-muted">+{r.gained}</td><td className="tabular text-right text-muted">−{r.lost}</td>
                <td className="tabular text-right font-semibold">{r.gained - r.lost >= 0 ? '+' : ''}{r.gained - r.lost}</td></tr>
            ))}
          </tbody></table>
        )}
        {vm.layer === 'history' && vm.marginTrend.length > 0 && (
          <table className="w-full max-w-xl text-sm"><thead><tr className="text-muted"><th className="text-left">{t('studio_year')}</th><th className="text-right">{t('studio_avg_margin')}</th><th className="text-right">{t('studio_median_margin')}</th></tr></thead><tbody>
            {vm.marginTrend.map(p => <tr key={p.year} className="border-b border-line"><td className="py-1.5">{p.year}</td><td className="tabular text-right">{p.avgMargin.toLocaleString()}</td><td className="tabular text-right">{p.medianMargin.toLocaleString()}</td></tr>)}
          </tbody></table>
        )}
        {vm.layer === 'history' && vm.partySwitches.length > 0 && (
          <p className="text-sm text-muted">{t('studio_party_switchers', { count: vm.partySwitches.length })}</p>
        )}
      </div>
    );
  }
  return (
    <section className="flex min-w-0 items-center gap-4 overflow-hidden rounded-tile border border-line bg-tile px-4">
      <p className="shrink-0 font-display text-lg font-bold text-ink">{headline}</p>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">{vm.insight.chips.map(c => <Chip key={c.id} c={c} vm={vm} />)}</div>
      <button type="button" onClick={vm.onFocus} aria-label={t('studio_expand', { name: headline })} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:text-accent">⤢</button>
    </section>
  );
}
```

`LeadersStrip.tsx`:
```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeadersVM, LeaderCard } from '../../viewmodels/tiles/useLeadersVM';
import { PickerSelect } from '../ui/PickerSelect';
import { cn } from '../ui/cn';

const STATUS_STYLE: Record<LeaderCard['status'], string> = {
  WON: 'bg-emerald-500/15 text-emerald-300', LEADING: 'bg-accent/15 text-accent', LOST: 'bg-live/15 text-live', TRAILING: 'bg-live/10 text-live', PENDING: 'bg-muted/15 text-muted',
};

function Card({ c, vm }: { c: LeaderCard; vm: LeadersVM }) {
  const { t } = useTranslation();
  const initials = c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const color = vm.partyColor.get(c.partyId) ?? '#8A93A6';
  return (
    <button type="button" onClick={() => vm.onSelectSeat(c.constId)} onMouseEnter={() => vm.onHoverSeat(c.constId)} onMouseLeave={() => vm.onHoverSeat(null)}
      className="flex h-12 min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-line bg-page/50 px-3 text-left hover:border-accent">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold" style={{ borderColor: color, color }}>{initials}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
        <span className="block truncate text-xs text-muted">{c.constName} · {c.partyId}</span>
      </span>
      <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.status])}>{t(`studio_status_${c.status.toLowerCase()}`)}</span>
      {c.margin != null && c.status !== 'PENDING' && <span className="tabular shrink-0 text-xs font-semibold text-ink">{c.status === 'WON' || c.status === 'LEADING' ? '+' : '−'}{c.margin.toLocaleString()}</span>}
    </button>
  );
}

export function LeadersStrip({ vm, variant }: { vm: LeadersVM; variant: 'tile' | 'focus' }) {
  const { t } = useTranslation();
  const [pick, setPick] = useState('');
  if (variant === 'focus') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <PickerSelect value={pick} onChange={setPick} ariaLabel={t('studio_add_seat')} placeholder={t('studio_add_seat')} options={vm.seatOptions.map(s => ({ value: s.id, label: s.name }))} />
          <button type="button" disabled={!pick} onClick={() => { vm.onAddCustom(pick); setPick(''); }} className="h-8 rounded-full bg-accent px-4 text-sm font-semibold text-page disabled:opacity-40">{t('studio_add')}</button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {vm.cards.map(c => (
            <div key={c.key} className="flex items-center gap-2">
              <Card c={c} vm={vm} />
              {c.custom && <button type="button" onClick={() => vm.onRemoveCustom(c.constId)} aria-label={t('studio_remove')} className="text-muted hover:text-live">✕</button>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <section className="flex min-w-0 items-center gap-3 overflow-hidden rounded-tile border border-line bg-tile px-4">
      <h2 className="shrink-0 font-display text-base font-bold uppercase tracking-wider text-ink">{t('studio_key_leaders')}</h2>
      <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
        {vm.cards.length === 0 && <span className="text-sm text-muted">{t('studio_no_leaders')}</span>}
        {vm.cards.map(c => <Card key={c.key} c={c} vm={vm} />)}
      </div>
      <button type="button" onClick={vm.onFocus} aria-label={t('studio_expand', { name: t('studio_key_leaders') })} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:text-accent">⤢</button>
    </section>
  );
}
```
(Cards that do not fit are clipped by `overflow-hidden` on a flex row whose children have `min-w-[240px]`; the expand button shows all.)

`StatsStrip.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import type { StatsVM, SeatRef } from '../../viewmodels/tiles/useStatsVM';

function Stat({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?(): void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="flex min-w-0 flex-1 flex-col justify-center rounded-xl border border-line bg-page/50 px-3 text-left enabled:hover:border-accent">
      <span className="truncate text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="flex min-w-0 items-baseline gap-2"><span className="tabular font-display text-3xl font-bold leading-none text-ink">{value}</span>{sub && <span className="truncate text-xs text-muted">{sub}</span>}</span>
    </button>
  );
}

function SeatList({ title, seats, vm }: { title: string; seats: SeatRef[]; vm: StatsVM }) {
  return (
    <div><h3 className="mb-2 font-display text-lg font-bold uppercase text-ink">{title}</h3>
      <ol className="flex flex-col gap-1">{seats.map(s => (
        <li key={s.id}><button type="button" onClick={() => vm.onSelectSeat(s.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-tile-raised">
          <span className="h-2 w-2 rounded-full" style={{ background: vm.partyColor.get(s.party) ?? '#8A93A6' }} />
          <span className="flex-1 truncate text-left">{s.name}</span><span className="text-muted">{s.party}</span><span className="tabular font-semibold">{s.margin.toLocaleString()}</span>
        </button></li>
      ))}</ol>
    </div>
  );
}

export function StatsStrip({ vm, variant }: { vm: StatsVM; variant: 'tile' | 'focus' }) {
  const { t } = useTranslation();
  const { stats } = vm;
  if (variant === 'focus') {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SeatList title={t('studio_closest_contests')} seats={vm.closest10} vm={vm} />
        <SeatList title={t('studio_biggest_wins')} seats={vm.biggest10} vm={vm} />
        {vm.flipped.length > 0 ? <SeatList title={t('studio_seats_flipped')} seats={vm.flipped} vm={vm} /> : (
          <div><h3 className="mb-2 font-display text-lg font-bold uppercase text-ink">{t('studio_live_feed')}</h3>
            <ul className="flex flex-col gap-1 text-sm">{vm.ticker.map(e => <li key={e.id}>{t(e.kind === 'won' ? 'studio_ticker_won' : 'studio_ticker_lead', { party: e.partyId, seat: e.constName })}</li>)}</ul></div>
        )}
      </div>
    );
  }
  const latest = vm.ticker[0];
  const tickerText = latest
    ? t(latest.kind === 'won' ? 'studio_ticker_won' : 'studio_ticker_lead', { party: latest.partyId, seat: latest.constName })
    : vm.isLive ? t('studio_ticker_waiting') : t('studio_ticker_all_declared', { count: stats.total });
  return (
    <section className="flex min-w-0 items-stretch gap-2 overflow-hidden rounded-tile border border-line bg-tile p-2">
      <Stat label={t('studio_declared')} value={`${stats.declared}/${stats.total}`} />
      <Stat label={t('studio_closest_contest')} value={stats.closest ? stats.closest.margin.toLocaleString() : '—'} sub={stats.closest ? `${stats.closest.name} · ${stats.closest.party}` : undefined} onClick={stats.closest ? () => vm.onSelectSeat(stats.closest!.id) : undefined} />
      <Stat label={t('studio_biggest_win')} value={stats.biggest ? stats.biggest.margin.toLocaleString() : '—'} sub={stats.biggest ? `${stats.biggest.name} · ${stats.biggest.party}` : undefined} onClick={stats.biggest ? () => vm.onSelectSeat(stats.biggest!.id) : undefined} />
      <Stat label={t('studio_seats_flipped')} value={stats.flipped != null ? String(stats.flipped) : '—'} />
      <div className="flex min-w-0 flex-[1.6] items-center gap-2 rounded-xl border border-line bg-page/50 px-3" aria-live="polite">
        <span className={vm.isLive ? 'h-2 w-2 shrink-0 animate-pulse rounded-full bg-live' : 'h-2 w-2 shrink-0 rounded-full bg-emerald-400'} />
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted">{vm.isLive ? t('studio_live') : t('studio_latest')}</span>
        <span className="truncate text-sm text-ink">{tickerText}</span>
      </div>
      <button type="button" onClick={vm.onFocus} aria-label={t('studio_expand', { name: t('studio_stats') })} className="grid w-8 shrink-0 place-items-center rounded-full text-muted hover:text-accent">⤢</button>
    </section>
  );
}
```

- [ ] **Step 5: Run to verify** — `npx vitest run src/views && npx tsc --noEmit && npm run lint` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views src/viewmodels/tiles/fit.ts
git commit -m "Add scoreboard, standings, insight, leaders and stats tiles"
```

---

### Task 15: Map — `useMapVM`, `MapCanvas`, `MapTile`, `SeatPanel`

**Files:**
- Create: `src/viewmodels/tiles/useMapVM.ts`, `src/views/map/MapCanvas.tsx`, `src/views/map/MapTile.tsx`, `src/views/map/SeatPanel.tsx`
- Modify: `src/model/types/index.ts` (add `hex_url?: string` to `ManifestData.geo`)
- Test: `src/viewmodels/__tests__/mapVM.test.tsx`

**Interfaces:**
- Consumes: `seatFills`, `MAP_FILL` (Task 9), `matchFeaturesToSeats` (Task 9), `ElectionService.getGeoJSON` (`model/api`), `useSources`, `useDashboardStore`, `activeHighlight`, `useMapRendering` (moved in Task 2), `SeatPanelVM` (Task 12).
- Produces:
```ts
export interface MapVM {
  status: 'loading' | 'error' | 'ready';
  features: GeoFeature[]; stateFeatures: GeoFeature[] | null; isVS: boolean;
  geoConfig?: { map_url?: string; center?: [number, number]; zoom?: number };
  seatOf: Map<GeoFeature, string>;
  fills: Map<string, SeatFill>;
  recentSeats: Set<string>; selectedSeat: string | null;
  layer: LayerId; layers: LayerId[]; mapMode: MapMode; hexAvailable: boolean;
  lockedLabel: string | null;
  seatInfo(id: string): { name: string; candidate: string; party: string; status: string; margin?: number; color: string } | null;
  onLayer(l: LayerId): void; onMapMode(m: MapMode): void; onSelect(id: string): void; onClearLock(): void; onFocus(): void;
}
export function useMapVM(): MapVM
export function MapCanvas(props: { vm: MapVM }): JSX.Element
export function MapTile(props: { vm: MapVM; variant: 'tile' | 'focus'; seatPanel?: ReactNode }): JSX.Element
export function SeatPanel(props: { vm: SeatPanelVM | null }): JSX.Element
```

- [ ] **Step 1: Write the failing VM test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardStoreProvider } from '../store/DashboardStoreProvider';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { useMapVM } from '../tiles/useMapVM';
import { ElectionService } from '../../model/api/election.service';
import { makeSources } from './fixtures';

vi.spyOn(ElectionService, 'getGeoJSON').mockResolvedValue({ type: 'FeatureCollection', features: [] });

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter><DashboardSourcesProvider value={makeSources()}><DashboardStoreProvider allowedLayers={['overview', 'battle']} knownSeats={null}>{children}</DashboardStoreProvider></DashboardSourcesProvider></MemoryRouter>
);

describe('useMapVM', () => {
  it('loads geometry, exposes fills per seat and hides hex without a layout', async () => {
    const { result } = renderHook(() => useMapVM(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.fills.get('BR_VS_1_SANDESH')).toEqual({ color: '#1FA37A', opacity: 1 });
    expect(result.current.hexAvailable).toBe(false);
    act(() => result.current.onLayer('battle'));
    expect(result.current.fills.get('BR_VS_1_SANDESH')?.opacity).toBe(0.25);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement `useMapVM`**

```ts
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { activeHighlight, type MapMode } from '../store/dashboardStore';
import { ElectionService } from '../../model/api/election.service';
import { seatFills, type SeatFill } from '../../model/derive/mapFill';
import { matchFeaturesToSeats } from '../../model/geo/featureMatch';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import type { LayerId } from '../../model/types/dashboard';

const LS_PC = '/geo/india_pc.geojson';
const LS_STATES = '/geo/india_states.geojson';

export interface MapVM {
  status: 'loading' | 'error' | 'ready';
  features: GeoFeature[];
  stateFeatures: GeoFeature[] | null;
  isVS: boolean;
  geoConfig?: { map_url?: string; center?: [number, number]; zoom?: number };
  seatOf: Map<GeoFeature, string>;
  fills: Map<string, SeatFill>;
  recentSeats: Set<string>;
  selectedSeat: string | null;
  layer: LayerId;
  layers: LayerId[];
  mapMode: MapMode;
  hexAvailable: boolean;
  lockedLabel: string | null;
  seatInfo(id: string): { name: string; candidate: string; party: string; status: string; margin?: number; color: string } | null;
  onLayer(l: LayerId): void;
  onMapMode(m: MapMode): void;
  onSelect(id: string): void;
  onClearLock(): void;
  onFocus(): void;
}

export function useMapVM(): MapVM {
  const { t } = useTranslation();
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const geo = src.data.manifestData?.geo;
  const isVS = src.election.type === 'VS';
  const url = geo?.map_url || LS_PC;
  const [status, setStatus] = useState<MapVM['status']>('loading');
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [stateFeatures, setStateFeatures] = useState<GeoFeature[] | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    Promise.all([ElectionService.getGeoJSON(url), isVS ? Promise.resolve(null) : ElectionService.getGeoJSON(LS_STATES)])
      .then(([pc, st]) => {
        if (!active) return;
        setFeatures(pc.features as GeoFeature[]);
        setStateFeatures(st ? (st.features as GeoFeature[]) : null);
        setStatus('ready');
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [url, isVS]);

  const seats = src.data.mapRegions;
  const seatOf = useMemo(() => matchFeaturesToSeats(features, seats), [features, seats]);
  const highlight = activeHighlight(state);
  // Highlight sets are rebuilt each render; key them by content so fills only recompute on real changes.
  const hlKey = `${[...highlight.parties].join(',')}|${[...highlight.seats].join(',')}`;
  const fillCtx = {
    layer: state.layer,
    electionType: src.election.type,
    partyColor: src.data.partyColorMap,
    swing: src.swing,
    dominance: src.dominance,
    spoilerSeats: src.data.spoilerData.spoilerSeats,
    threeWaySeats: src.data.spoilerData.threeWaySeats,
    highlight,
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fills = useMemo(() => seatFills(seats, fillCtx), [seats, state.layer, src.election.type, src.data.partyColorMap, src.swing, src.dominance, src.data.spoilerData, hlKey]);

  const byId = useMemo(() => new Map(seats.map(s => [s.id, s])), [seats]);
  const lockedId = state.locked?.chipId ?? null;

  return {
    status, features, stateFeatures, isVS, geoConfig: geo, seatOf, fills,
    recentSeats: src.recentSeats, selectedSeat: state.selectedSeat,
    layer: state.layer, layers: src.availableLayers, mapMode: state.mapMode, hexAvailable: Boolean(geo?.hex_url),
    lockedLabel: lockedId ? lockedId.replace(/^(party|bloc|chip):/, '').replace('>', ' → ') : null,
    seatInfo: id => {
      const s = byId.get(id);
      if (!s) return null;
      return { name: s.name, candidate: s.candidate, party: s.party, status: s.party ? t(s.status.toLowerCase(), s.status) : t('results_pending'), margin: s.margin, color: s.partyColor };
    },
    onLayer: l => dispatch({ type: 'setLayer', layer: l }),
    onMapMode: m => dispatch({ type: 'setMapMode', mode: m }),
    onSelect: id => dispatch({ type: 'selectSeat', seat: id }),
    onClearLock: () => dispatch({ type: 'clearLock' }),
    onFocus: () => dispatch({ type: 'focus', tile: 'map' }),
  };
}
```
Hovering a seat only shows the tooltip (local state in `MapCanvas`); it never dims the map — only tile hovers do.

In `src/model/types/index.ts` change `geo?: { map_url?: string; center?: [number, number]; zoom?: number };` to `geo?: { map_url?: string; hex_url?: string; center?: [number, number]; zoom?: number };`.

- [ ] **Step 4: Implement `MapCanvas`** (reuses the moved `useMapRendering` for projection/paths/zoom/labels; only fills and events are new)

```tsx
import { useEffect, useRef, useState } from 'react';
import { select } from 'd3';
import type { MapVM } from '../../viewmodels/tiles/useMapVM';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import { useMapRendering } from './useMapRendering';

const W = 560;
const H = 680;

export function MapCanvas({ vm }: { vm: MapVM }) {
  const geoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const stateGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  geoRef.current = vm.features.length ? { type: 'FeatureCollection', features: vm.features } : null;
  stateGeoRef.current = vm.stateFeatures ? { type: 'FeatureCollection', features: vm.stateFeatures } : null;
  const loaded = vm.status === 'ready' && vm.features.length > 0;
  const { svgRef, gRef, handleResetZoom } = useMapRendering({ loaded, geoRef, stateGeoRef, isVS: vm.isVS, geoConfig: vm.geoConfig, MAP_WIDTH: W, MAP_HEIGHT: H, showLabels: true });
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const vmRef = useRef(vm);
  vmRef.current = vm;

  // Events, bound once per geometry.
  useEffect(() => {
    if (!loaded || !gRef.current) return;
    gRef.current.selectAll<SVGPathElement, GeoFeature>('path.pc')
      .style('cursor', 'pointer')
      .on('click', (_e, d) => { const id = vmRef.current.seatOf.get(d); if (id) vmRef.current.onSelect(id); })
      .on('mousemove', (e: MouseEvent, d) => { const id = vmRef.current.seatOf.get(d); setTip(id ? { id, x: e.clientX, y: e.clientY } : null); })
      .on('mouseleave', () => setTip(null));
  }, [loaded, gRef]);

  // Fills from the view-model.
  useEffect(() => {
    if (!loaded || !gRef.current) return;
    gRef.current.selectAll<SVGPathElement, GeoFeature>('path.pc').each(function (d) {
      const id = vm.seatOf.get(d);
      const fill = id ? vm.fills.get(id) : undefined;
      const el = select(this);
      el.style('fill', fill?.color ?? 'var(--color-map-pending)')
        .style('fill-opacity', String(fill?.opacity ?? 1))
        .style('stroke', id && id === vm.selectedSeat ? 'var(--color-ink)' : 'var(--color-map-stroke)')
        .style('stroke-width', id && id === vm.selectedSeat ? '1.5px' : '0.4px')
        .classed('studio-seat-pulse', !!id && vm.recentSeats.has(id));
    });
  }, [loaded, gRef, vm.fills, vm.seatOf, vm.selectedSeat, vm.recentSeats]);

  const info = tip ? vm.seatInfo(tip.id) : null;
  return (
    <div className="relative h-full w-full">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full [&_.map-bg]:fill-[var(--color-map-bg)] [&_path.state-border]:stroke-line" role="img" />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button type="button" onClick={handleResetZoom} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-tile text-muted hover:text-ink" aria-label="reset zoom">⟳</button>
      </div>
      {info && tip && (
        <div className="pointer-events-none fixed z-30 rounded-xl border border-line bg-page/95 px-3 py-2 text-xs shadow-xl" style={{ left: tip.x + 14, top: tip.y - 12, borderLeft: `3px solid ${info.color}` }}>
          <div className="font-display text-sm font-bold uppercase text-ink">{info.name}</div>
          {info.candidate && <div className="text-ink">{info.candidate}</div>}
          <div className="text-muted">{info.party} · {info.status}{info.margin ? ` · +${info.margin.toLocaleString()}` : ''}</div>
        </div>
      )}
    </div>
  );
}
```
Before writing this, open `src/views/map/useMapRendering.ts` and check what it returns (`svgRef`, `gRef`, `handleResetZoom` are in the baseline) and which class names it gives paths (`path.pc`, a background `rect.map-bg`, state borders). If names differ, use the actual names — do not change `useMapRendering`'s behaviour except removing hard-coded light colours it sets via `.attr('fill'|'stroke', …)` on the background/border (replace with `var(--color-map-bg)` / `var(--color-line)`), since legacy pages also use it through the shim and the legacy CSS variables still exist there. Add to `studio.css`:
```css
@keyframes studio-seat-pulse { 0%,100% { stroke-width: .4px; } 50% { stroke: var(--color-ink); stroke-width: 2px; } }
.studio-seat-pulse { animation: studio-seat-pulse 900ms ease-in-out 2; }
```

- [ ] **Step 5: Implement `MapTile` and `SeatPanel`**

`MapTile.tsx`:
```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapVM } from '../../viewmodels/tiles/useMapVM';
import type { LayerId } from '../../model/types/dashboard';
import { Tile } from '../dashboard/Tile';
import { PillToggle } from '../ui/PillToggle';
import { MapCanvas } from './MapCanvas';

export function MapTile({ vm, variant, seatPanel }: { vm: MapVM; variant: 'tile' | 'focus'; seatPanel?: ReactNode }) {
  const { t } = useTranslation();
  const layers = <PillToggle<LayerId> value={vm.layer} onChange={vm.onLayer} ariaLabel={t('studio_map_layers')} size="sm" options={vm.layers.map(l => ({ value: l, label: t(`map_tab_${l}`) }))} />;
  const mode = vm.hexAvailable ? <PillToggle value={vm.mapMode} onChange={vm.onMapMode} ariaLabel={t('studio_map_mode')} size="sm" options={[{ value: 'map', label: t('studio_map') }, { value: 'hex', label: t('studio_hex') }]} /> : null;
  const canvas = (
    <div className="relative h-full">
      {vm.status === 'loading' && <p className="absolute inset-0 grid place-items-center text-sm text-muted">{t('loading_map')}</p>}
      {vm.status === 'error' && <p className="absolute inset-0 grid place-items-center text-sm text-live">{t('map_load_failed')}</p>}
      <MapCanvas vm={vm} />
      {vm.lockedLabel && (
        <button type="button" onClick={vm.onClearLock} className="absolute left-3 top-2 inline-flex items-center gap-2 rounded-full border border-accent bg-tile px-3 py-1 text-xs text-ink">
          {vm.lockedLabel} <span aria-hidden>✕</span><span className="sr-only">{t('studio_clear_highlight')}</span>
        </button>
      )}
    </div>
  );
  if (variant === 'focus') {
    return (
      <div className="flex h-full min-h-[70vh] flex-col gap-3">
        <div className="flex items-center gap-2">{layers}{mode}</div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          {canvas}
          {seatPanel}
        </div>
      </div>
    );
  }
  return <Tile title={t('constituency_map')} onExpand={vm.onFocus} actions={<>{layers}{mode}</>} bodyClassName="px-2 pb-2">{canvas}</Tile>;
}
```

`SeatPanel.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SeatPanelVM } from '../../viewmodels/tiles/useSeatPanelVM';

export function SeatPanel({ vm }: { vm: SeatPanelVM | null }) {
  const { t } = useTranslation();
  if (!vm) return <aside className="rounded-tile border border-line bg-page/40 p-4 text-sm text-muted">{t('studio_pick_seat')}</aside>;
  const total = vm.candidates.reduce((s, c) => s + c.votes, 0) || 1;
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-auto rounded-tile border border-line bg-page/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl font-bold uppercase text-ink">{vm.name}</h3>
        <button type="button" onClick={vm.onClose} className="text-muted hover:text-ink" aria-label={t('studio_close')}>✕</button>
      </div>
      {vm.margin != null && <p className="text-sm text-muted">{t('studio_margin', { count: vm.margin })}</p>}
      {vm.history && <p className="text-sm text-muted">{t(`studio_chip_${vm.history.classification}`, vm.history.classification)}{vm.history.dominantParty ? ` · ${vm.history.dominantParty}` : ''}</p>}
      {vm.briefing && <p className="rounded-lg border border-line bg-tile p-3 text-sm leading-relaxed text-ink">{vm.briefing}</p>}
      <ol className="flex flex-col gap-2">
        {vm.candidates.map(c => (
          <li key={`${c.name}-${c.partyId}`} className="rounded-lg border border-line p-2">
            <div className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} /><span className="flex-1 truncate font-semibold text-ink">{c.name}</span><span className="text-muted">{c.partyId}</span></div>
            <div className="mt-1 flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-page"><span className="block h-full" style={{ width: `${(c.votes / total) * 100}%`, background: c.color }} /></span><span className="tabular text-xs text-muted">{c.votes.toLocaleString()}</span></div>
          </li>
        ))}
      </ol>
      <Link to={vm.fullPageHref} className="mt-auto text-sm font-semibold text-accent hover:underline">{t('view_full_page')} →</Link>
    </aside>
  );
}
```

- [ ] **Step 6: Run the checks** — `npx vitest run && npx tsc --noEmit && npm run lint` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/viewmodels/tiles/useMapVM.ts src/views/map src/model/types/index.ts src/theme/studio.css src/viewmodels/__tests__/mapVM.test.tsx
git commit -m "Add map view-model, D3 MapCanvas, map tile and seat panel"
```

---

### Task 16: Views — top bar, search, share

**Files:**
- Create: `src/views/dashboard/TopBar.tsx`, `src/views/dashboard/SearchBox.tsx`, `src/views/dashboard/ShareMenu.tsx`, `src/viewmodels/tiles/useSearchVM.ts`
- Test: `src/views/__tests__/share.test.tsx`

**Interfaces:**
- Consumes: `TopBarVM` (Task 12), `useGlobalSearch` (`viewmodels/data`), `PickerSelect`, `PillToggle`.
- Produces:
```ts
export interface SearchVM { query: string; open: boolean; seats: { id: string; name: string; meta: string }[]; candidates: { id: string; seatId: string; name: string; meta: string }[]; onQuery(q: string): void; onOpen(o: boolean): void; onPick(seatId: string): void }
export function useSearchVM(electionId: string, onSeat: (id: string) => void): SearchVM
export function shareLinks(text: string, url: string): { whatsapp: string; twitter: string }
export function TopBar(props: { vm: TopBarVM; search: SearchVM }): JSX.Element
```

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { shareLinks } from '../dashboard/ShareMenu';

describe('shareLinks', () => {
  it('encodes text and url for WhatsApp and X/Twitter', () => {
    const l = shareLinks('Bihar 2025 - Election Tracker', 'http://localhost:3080/election/e1?layer=swing');
    expect(l.whatsapp).toBe('https://wa.me/?text=Bihar%202025%20-%20Election%20Tracker%20http%3A%2F%2Flocalhost%3A3080%2Felection%2Fe1%3Flayer%3Dswing');
    expect(l.twitter).toBe('https://twitter.com/intent/tweet?text=Bihar%202025%20-%20Election%20Tracker&url=http%3A%2F%2Flocalhost%3A3080%2Felection%2Fe1%3Flayer%3Dswing');
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

`useSearchVM.ts`:
```ts
import { useGlobalSearch } from '../data/useGlobalSearch';

export interface SearchVM {
  query: string;
  open: boolean;
  seats: { id: string; name: string; meta: string }[];
  candidates: { id: string; seatId: string; name: string; meta: string }[];
  onQuery(q: string): void;
  onOpen(o: boolean): void;
  onPick(seatId: string): void;
}

export function useSearchVM(electionId: string, onSeat: (id: string) => void): SearchVM {
  const s = useGlobalSearch(electionId);
  return {
    query: s.query,
    open: s.open && s.hasResults,
    seats: s.constituencies.slice(0, 8).map(c => ({ id: c.id, name: c.name, meta: `#${c.const_no} ${c.district?.name ?? ''}`.trim() })),
    candidates: s.candidates.slice(0, 8).map(c => ({ id: c.id, seatId: c.const_id, name: c.name, meta: c.party?.name ?? '' })),
    onQuery: s.handleQueryChange,
    onOpen: s.setOpen,
    onPick: seatId => { onSeat(seatId); s.reset(); },
  };
}
```

`ShareMenu.tsx`:
```tsx
import { useTranslation } from 'react-i18next';

export function shareLinks(text: string, url: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  };
}

export function ShareMenu({ text }: { text: string }) {
  const { t } = useTranslation();
  const links = shareLinks(text, typeof window !== 'undefined' ? window.location.href : '');
  return (
    <div className="flex items-center gap-1">
      <a href={links.whatsapp} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">{t('studio_share_whatsapp')}</a>
      <a href={links.twitter} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">{t('studio_share_x')}</a>
    </div>
  );
}
```

`SearchBox.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';

export function SearchBox({ vm }: { vm: SearchVM }) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) vm.onOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [vm]);
  return (
    <div ref={box} className="relative min-w-0 max-w-sm flex-1">
      <input type="search" value={vm.query} onChange={e => vm.onQuery(e.target.value)} onFocus={() => vm.onOpen(true)} onKeyDown={e => { if (e.key === 'Escape') vm.onOpen(false); }}
        placeholder={t('search_placeholder')} aria-label={t('search')}
        className="h-8 w-full rounded-full border border-line bg-page/60 px-4 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none" />
      {vm.open && (
        <div className="studio-root absolute left-0 right-0 top-10 z-40 max-h-96 overflow-auto rounded-xl border border-line bg-tile p-1 shadow-2xl">
          {vm.seats.length > 0 && <div className="px-3 py-1 text-[11px] uppercase text-muted">{t('constituency')}</div>}
          {vm.seats.map(s => <button key={s.id} type="button" onClick={() => vm.onPick(s.id)} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-tile-raised"><span className="text-ink">{s.name}</span> <span className="text-xs text-muted">{s.meta}</span></button>)}
          {vm.candidates.length > 0 && <div className="px-3 py-1 text-[11px] uppercase text-muted">{t('candidates')}</div>}
          {vm.candidates.map(c => <button key={c.id} type="button" onClick={() => vm.onPick(c.seatId)} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-tile-raised"><span className="text-ink">{c.name}</span> <span className="text-xs text-muted">{c.meta}</span></button>)}
        </div>
      )}
    </div>
  );
}
```

`TopBar.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TopBarVM } from '../../viewmodels/tiles/useTopBarVM';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';
import { PillToggle } from '../ui/PillToggle';
import { PickerSelect } from '../ui/PickerSelect';
import { SearchBox } from './SearchBox';
import { ShareMenu } from './ShareMenu';

export function TopBar({ vm, search }: { vm: TopBarVM; search: SearchVM }) {
  const { t } = useTranslation();
  const s = vm.statusLabel;
  return (
    <header className="flex h-12 min-w-0 items-center gap-3 rounded-tile border border-line bg-tile px-4">
      <Link to="/" className="shrink-0 font-display text-lg font-bold text-ink">{t('app_title')}</Link>
      <PillToggle value={vm.electionType} onChange={vm.onType} ariaLabel={t('studio_election_type')} size="sm" options={[{ value: 'LS', label: t('lok_sabha') }, { value: 'VS', label: t('vidhan_sabha') }]} />
      {vm.electionType === 'VS' ? (
        <>
          <PickerSelect value={String(vm.stateId ?? '')} onChange={v => vm.onState(Number(v))} ariaLabel={t('select_state')} placeholder={t('select_state')} options={vm.states.map(x => ({ value: String(x.id), label: x.name }))} />
          <PickerSelect value={vm.electionId} onChange={vm.onElection} ariaLabel={t('studio_year')} options={vm.years.map(y => ({ value: y.id, label: String(y.year) }))} />
        </>
      ) : (
        <PickerSelect value={vm.electionId} onChange={vm.onElection} ariaLabel={t('select_election')} options={vm.lsElections.map(e => ({ value: e.id, label: e.name }))} />
      )}
      <SearchBox vm={search} />
      <span className="ml-auto hidden shrink-0 items-center gap-2 rounded-full border border-line px-3 py-1 text-xs xl:inline-flex">
        <span className={s.kind === 'live' ? 'h-2 w-2 animate-pulse rounded-full bg-live' : 'h-2 w-2 rounded-full bg-emerald-400'} />
        {t(`studio_status_label_${s.kind}`, { declared: s.declared, total: s.total })}
      </span>
      <ShareMenu text={vm.shareText} />
      <PickerSelect value={vm.lang} onChange={vm.onLang} ariaLabel={t('studio_language')} options={vm.langs.map(l => ({ value: l, label: l.toUpperCase() }))} />
    </header>
  );
}
```

- [ ] **Step 4: Run the checks** — `npx vitest run && npx tsc --noEmit && npm run lint` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/dashboard/TopBar.tsx src/views/dashboard/SearchBox.tsx src/views/dashboard/ShareMenu.tsx src/viewmodels/tiles/useSearchVM.ts src/views/__tests__/share.test.tsx
git commit -m "Add studio top bar, search and share"
```

---

### Task 17: Views — desktop grid, mobile card rail

**Files:**
- Create: `src/views/dashboard/DashboardGrid.tsx`, `src/views/dashboard/MobileCardRail.tsx`
- Test: `src/views/__tests__/grid.test.tsx`

**Interfaces:**
- Consumes: every tile view + VM type (Tasks 12–16), `FocusOverlay`, `useMediaQuery`.
- Produces:
```tsx
export interface DashboardViewProps {
  topBar: TopBarVM; search: SearchVM; scoreboard: ScoreboardVM; standings: StandingsVM; insight: LayerInsightVM;
  leaders: LeadersVM; stats: StatsVM; map: MapVM; seatPanel: SeatPanelVM | null;
  focus: FocusTile | null; onCloseFocus(): void;
}
export function DashboardGrid(props: DashboardViewProps): JSX.Element   // switches desktop/mobile at 1024px
export function MobileCardRail(props: { cards: { id: FocusTile; title: string; node: ReactNode; onOpen(): void }[] }): JSX.Element
```

- [ ] **Step 1: Write the failing test** (layout contract: root is exactly the viewport and never scrolls)

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MobileCardRail } from '../dashboard/MobileCardRail';

describe('MobileCardRail', () => {
  it('renders one snap card per tile with page dots', () => {
    const { container } = render(<MobileCardRail cards={[
      { id: 'insight', title: 'Swing', node: 'a', onOpen: () => {} },
      { id: 'standings', title: 'Parties', node: 'b', onOpen: () => {} },
    ]} />);
    expect(container.querySelectorAll('[data-rail-card]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-rail-dot]')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

`MobileCardRail.tsx`:
```tsx
import { useState, type ReactNode } from 'react';
import type { FocusTile } from '../../viewmodels/store/dashboardStore';
import { cn } from '../ui/cn';

export function MobileCardRail({ cards }: { cards: { id: FocusTile; title: string; node: ReactNode; onOpen(): void }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 [scrollbar-width:none]"
        onScroll={e => { const el = e.currentTarget; setActive(Math.round(el.scrollLeft / (el.clientWidth * 0.86))); }}>
        {cards.map(c => (
          <button key={c.id} type="button" data-rail-card onClick={c.onOpen}
            className="h-[150px] w-[86%] shrink-0 snap-start overflow-hidden rounded-tile border border-line bg-tile p-3 text-left">
            <div className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-ink">{c.title}</div>
            <div className="pointer-events-none">{c.node}</div>
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 pb-2">
        {cards.map((c, i) => <span key={c.id} data-rail-dot className={cn('h-1.5 w-1.5 rounded-full', i === active ? 'bg-accent' : 'bg-line')} />)}
      </div>
    </div>
  );
}
```

`DashboardGrid.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import type { TopBarVM } from '../../viewmodels/tiles/useTopBarVM';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';
import type { ScoreboardVM } from '../../viewmodels/tiles/useScoreboardVM';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';
import type { LayerInsightVM } from '../../viewmodels/tiles/useLayerInsightVM';
import type { LeadersVM } from '../../viewmodels/tiles/useLeadersVM';
import type { StatsVM } from '../../viewmodels/tiles/useStatsVM';
import type { MapVM } from '../../viewmodels/tiles/useMapVM';
import type { SeatPanelVM } from '../../viewmodels/tiles/useSeatPanelVM';
import type { FocusTile } from '../../viewmodels/store/dashboardStore';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { TopBar } from './TopBar';
import { ScoreboardTile } from './ScoreboardTile';
import { StandingsTile } from './StandingsTile';
import { LayerInsightStrip } from './LayerInsightStrip';
import { LeadersStrip } from './LeadersStrip';
import { StatsStrip } from './StatsStrip';
import { FocusOverlay } from './FocusOverlay';
import { MobileCardRail } from './MobileCardRail';
import { MapTile } from '../map/MapTile';
import { SeatPanel } from '../map/SeatPanel';

export interface DashboardViewProps {
  topBar: TopBarVM; search: SearchVM; scoreboard: ScoreboardVM; standings: StandingsVM; insight: LayerInsightVM;
  leaders: LeadersVM; stats: StatsVM; map: MapVM; seatPanel: SeatPanelVM | null;
  focus: FocusTile | null; onCloseFocus(): void;
}

export function DashboardGrid(p: DashboardViewProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const titles: Record<FocusTile, string> = {
    map: t('constituency_map'), scoreboard: t('studio_results'), standings: t('party_standings'),
    insight: t(`map_tab_${p.insight.layer}`), leaders: t('studio_key_leaders'), stats: t('studio_stats'),
  };
  const overlay = (
    <FocusOverlay tile={p.focus} titles={titles} onClose={p.onCloseFocus} render={tile => {
      switch (tile) {
        case 'map': return <MapTile vm={p.map} variant="focus" seatPanel={<SeatPanel vm={p.seatPanel} />} />;
        case 'scoreboard': return <ScoreboardTile vm={p.scoreboard} variant="focus" />;
        case 'standings': return <StandingsTile vm={p.standings} variant="focus" />;
        case 'insight': return <LayerInsightStrip vm={p.insight} variant="focus" />;
        case 'leaders': return <LeadersStrip vm={p.leaders} variant="focus" />;
        case 'stats': return <StatsStrip vm={p.stats} variant="focus" />;
      }
    }} />
  );

  if (!desktop) {
    return (
      <div className="studio-root flex h-dvh w-screen flex-col gap-2 overflow-hidden pt-2">
        <div className="px-3"><TopBar vm={p.topBar} search={p.search} /></div>
        <div className="px-3"><div className="rounded-tile border border-line bg-tile p-3"><ScoreboardTile vm={p.scoreboard} variant="compact" /></div></div>
        <div className="min-h-0 flex-1 px-3"><MapTile vm={p.map} variant="tile" /></div>
        <MobileCardRail cards={[
          { id: 'insight', title: titles.insight, node: <LayerInsightStrip vm={p.insight} variant="tile" />, onOpen: p.insight.onFocus },
          { id: 'standings', title: titles.standings, node: <StandingsTile vm={p.standings} variant="focus" />, onOpen: p.standings.onFocus },
          { id: 'leaders', title: titles.leaders, node: <LeadersStrip vm={p.leaders} variant="tile" />, onOpen: p.leaders.onFocus },
          { id: 'stats', title: titles.stats, node: <StatsStrip vm={p.stats} variant="tile" />, onOpen: p.stats.onFocus },
        ]} />
        {overlay}
      </div>
    );
  }

  return (
    <div className="studio-root grid h-screen w-screen grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)] grid-rows-[48px_minmax(0,1fr)_56px_64px_64px] gap-3 overflow-hidden p-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]">
      <div className="col-span-2"><TopBar vm={p.topBar} search={p.search} /></div>
      <MapTile vm={p.map} variant="tile" />
      <div className="grid min-h-0 grid-rows-[220px_minmax(0,1fr)] gap-3">
        <ScoreboardTile vm={p.scoreboard} variant="tile" />
        <StandingsTile vm={p.standings} variant="tile" />
      </div>
      <div className="col-span-2 grid min-h-0"><LayerInsightStrip vm={p.insight} variant="tile" /></div>
      <div className="col-span-2 grid min-h-0"><LeadersStrip vm={p.leaders} variant="tile" /></div>
      <div className="col-span-2 grid min-h-0"><StatsStrip vm={p.stats} variant="tile" /></div>
      {overlay}
    </div>
  );
}
```

- [ ] **Step 4: Run the checks** — `npx vitest run && npx tsc --noEmit && npm run lint` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/dashboard/DashboardGrid.tsx src/views/dashboard/MobileCardRail.tsx src/views/__tests__/grid.test.tsx
git commit -m "Add desktop tile grid and mobile card rail"
```

---

### Task 18: Composition — `StudioDashboard` page, routing, i18n, party colours

**Files:**
- Create: `src/pages/StudioDashboard.tsx`, `database/migrations/013_party_colors_dark.sql`
- Modify: `src/pages/ElectionView.tsx`, `src/pages/Home.tsx`, `src/App.tsx`, `docs/FEATURES.md`
- Test: `src/__tests__/i18n.test.ts` (existing), `npm run build`

**Interfaces:**
- Consumes: everything above.
- Produces: `export default function StudioDashboard(): JSX.Element` rendering the studio for the context election.

- [ ] **Step 1: Implement the composition page**

```tsx
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useElection } from '../viewmodels/data/useElection';
import { useDashboardSources } from '../viewmodels/sources/useDashboardSources';
import { DashboardSourcesProvider } from '../viewmodels/sources/DashboardSourcesProvider';
import { DashboardStoreProvider, useDashboardStore } from '../viewmodels/store/DashboardStoreProvider';
import { useTopBarVM } from '../viewmodels/tiles/useTopBarVM';
import { useSearchVM } from '../viewmodels/tiles/useSearchVM';
import { useScoreboardVM } from '../viewmodels/tiles/useScoreboardVM';
import { useStandingsVM } from '../viewmodels/tiles/useStandingsVM';
import { useLayerInsightVM } from '../viewmodels/tiles/useLayerInsightVM';
import { useLeadersVM } from '../viewmodels/tiles/useLeadersVM';
import { useStatsVM } from '../viewmodels/tiles/useStatsVM';
import { useMapVM } from '../viewmodels/tiles/useMapVM';
import { useSeatPanelVM } from '../viewmodels/tiles/useSeatPanelVM';
import { DashboardGrid } from '../views/dashboard/DashboardGrid';
import type { Election } from '../model/types';

function Wall() {
  const { state, dispatch } = useDashboardStore();
  const topBar = useTopBarVM();
  const search = useSearchVM(topBar.electionId, topBar.onSearchSeat);
  return (
    <DashboardGrid
      topBar={topBar} search={search}
      scoreboard={useScoreboardVM()} standings={useStandingsVM()} insight={useLayerInsightVM()}
      leaders={useLeadersVM()} stats={useStatsVM()} map={useMapVM()} seatPanel={useSeatPanelVM()}
      focus={state.focus} onCloseFocus={() => dispatch({ type: 'focus', tile: null })}
    />
  );
}

function Loaded({ election }: { election: Election }) {
  const sources = useDashboardSources(election);
  const { t } = useTranslation();
  const knownSeats = useMemo(() => (sources.data.mapRegions.length ? new Set(sources.data.mapRegions.map(r => r.id)) : null), [sources.data.mapRegions]);
  if (sources.data.error && sources.data.mapRegions.length === 0) {
    return (
      <div className="studio-root grid h-screen place-items-center">
        <div className="text-center"><p className="font-semibold text-live">{t('failed_to_load_election')}</p>
          <button type="button" onClick={sources.data.refreshAll} className="mt-3 rounded-full border border-line px-4 py-1.5 text-sm">{t('retry')}</button></div>
      </div>
    );
  }
  return (
    <DashboardSourcesProvider value={sources}>
      <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={knownSeats}>
        <Wall />
      </DashboardStoreProvider>
    </DashboardSourcesProvider>
  );
}

export default function StudioDashboard() {
  const { election } = useElection();
  const { t } = useTranslation();
  if (!election) return <div className="studio-root grid h-screen place-items-center text-muted">{t('select_election_prompt')}</div>;
  return <Loaded key={election.id} election={election} />;
}
```

- [ ] **Step 2: Route it**

- `src/pages/ElectionView.tsx`: replace `import Dashboard from './Dashboard';` with `import StudioDashboard from './StudioDashboard';` and `return <Dashboard />;` with `return <StudioDashboard />;`. Replace the loading `<Spinner …>` return with `<div className="studio-root h-screen" />` so the dark background shows while loading.
- `src/pages/Home.tsx`: render `StudioDashboard` instead of `Dashboard`.
- `src/App.tsx` `AppLayout`: the studio has its own top bar, so hide the legacy `Header` on the dashboard routes:
```tsx
import { useMatch } from 'react-router-dom';
// inside AppLayout:
const onElection = useMatch('/election/:id');
const onHome = useMatch('/');
const studio = Boolean(onElection || onHome);
// …
{!studio && <Header elections={elections || []} states={states || []} sseConnected={sseConnected} />}
<main style={{ flex: 1, width: '100%', overflowY: studio ? 'hidden' : 'auto', position: 'relative' }}>
```

- [ ] **Step 3: Confirm translations** — run `npx vitest run src/__tests__/i18n.test.ts`. Every `studio_*` key was added in Task 13; if the test reports a missing key, add it to all four locale files.

- [ ] **Step 4: Fix clashing party colours in the data** (spec §7 — data is the source of truth)

`database/migrations/013_party_colors_dark.sql`:
```sql
-- Party colours that were indistinguishable on the dark studio dashboard
-- (JD(U) vs RJD vs AIMIM greens, HAM(S)/RLM greys vs Others, CPI(ML)/CPI(M) reds).
-- Idempotent: plain UPDATEs keyed by party id.
UPDATE parties SET color = '#1FA37A' WHERE id = 'JDU';
UPDATE parties SET color = '#7BD34A' WHERE id = 'RJD';
UPDATE parties SET color = '#2BB673' WHERE id = 'AIMIM';
UPDATE parties SET color = '#E8C547' WHERE id = 'HAMS';
UPDATE parties SET color = '#D06CB0' WHERE id = 'RLM';
UPDATE parties SET color = '#3B8BFF' WHERE id = 'LJPRV';
UPDATE parties SET color = '#38C6F4' WHERE id = 'INC';
UPDATE parties SET color = '#FF7A1A' WHERE id = 'BJP';
UPDATE parties SET color = '#E5484D' WHERE id = 'CPIML';
UPDATE parties SET color = '#B83A3E' WHERE id = 'CPIM';
UPDATE parties SET color = '#4B5BD6' WHERE id = 'BSP';
```
Apply it to the running dev DB: `cd .. && set -a && . ./.env && set +a && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/013_party_colors_dark.sql` (strip the `?schema=public` suffix if psql rejects it), then flush the backend cache: `docker exec election_tracker_redis redis-cli FLUSHDB`.

- [ ] **Step 5: Document the feature** — in `docs/FEATURES.md` add under "In progress":

```markdown
### Studio dashboard (redesign, branch `feat/fe-redesign`)
- Non-scrolling dark tile wall (1440×900 / 1280×720) and map-first mobile layout with a swipeable card rail.
- Tiles: top bar, map (layers, Map|Hex when `geo.hex_url` is set), scoreboard, party standings, layer insight strip, key leaders, stats + live ticker. Any tile expands to a focus overlay; `?layer=`, `?seat=`, `?focus=` make every view linkable.
- MVVM: `src/model` (pure), `src/viewmodels` (hooks), `src/views` (Tailwind + Radix); boundaries enforced by `npm run lint`.
- Spec: `docs/superpowers/specs/2026-09-29-studio-dashboard-design.md`.
```

- [ ] **Step 6: Run everything** — `npx vitest run && npx tsc --noEmit && npm run lint && npm run build` → all PASS. Open http://localhost:3080/election/c3d4e5f6-a7b8-9012-cdef-234567890abc and confirm the studio wall renders with real numbers (NDA 202 / MGB 34, closest Sandesh 27, biggest Rupauli 73,572, 111 flipped on Swing).

- [ ] **Step 7: Commit**

```bash
git add -A src/pages src/App.tsx ../database/migrations/013_party_colors_dark.sql ../docs/FEATURES.md
git commit -m "Wire the studio dashboard into routing, add translations and dark-safe party colours"
```

---

### Task 19: Browser verification — no-scroll, focus, parity against the baseline

**Files:**
- Create: `frontend/playwright.config.ts`, `frontend/e2e/dashboard.spec.ts`
- Test: `npm run e2e` (needs backend :3082, redesign :3080, baseline :3086 running)

**Interfaces:**
- Consumes: the running app. Bihar 2025 id `c3d4e5f6-a7b8-9012-cdef-234567890abc`; the LS 2024 id is looked up from the API in `beforeAll`.

- [ ] **Step 1: Install the browser** — `npx playwright install chromium`

- [ ] **Step 2: Write the e2e spec**

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: 'e2e', use: { baseURL: 'http://localhost:3080' }, reporter: 'list' });
```

`e2e/dashboard.spec.ts`:
```ts
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
```
Add `e2e/__shots__/` to `frontend/.gitignore` (create the file if missing).

- [ ] **Step 3: Run it** — `npm run e2e`
Expected: all tests PASS. If the no-scroll test fails at 1280×720, reduce the fixed row heights in `DashboardGrid` (`56px/64px/64px` → `52px/58px/58px`) and the scoreboard row (`220px` → `196px`), then re-run; do not add scrollbars.

- [ ] **Step 4: Walk the parity checklist (spec §9) manually on :3080 vs :3086** and tick each item in the spec file:
LS/VS switch + state/year + last-election memory · search → seat · every layer · party highlight (replaces alliance filter/+Party) · tooltip, click → seat detail, zoom/pan/reset, labels by zoom · tally + majority · standings with vote % (focus view) · leaders & custom watchlist (same `watchlist_<id>` storage) · stats · live (run `cd ../scraper && npm run sim:setup && npm run sim:server` and `npm run sim:replay` per `scraper/package.json`, then watch ticker, pulses, in-place updates and reconnect) · share · all four languages · link to constituency page and person page (from the constituency page).
Record any gap as a new checkbox task at the end of this plan before continuing.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/dashboard.spec.ts .gitignore ../docs/superpowers/specs/2026-09-29-studio-dashboard-design.md
git commit -m "Add Playwright checks for no-scroll layout, focus overlay and URL state"
```

---

### Task 20: Remove the legacy dashboard code

**Files:**
- Delete: `src/pages/Dashboard.tsx`, `src/components/organisms/{AllianceTally,ElectionSummary,WatchlistPanel,KeyBattlesTicker,ConstituencyModal,InteractiveMap,MapControls,MapLegend,StatesMiniMap,ConstituencyModalHeader}.tsx`, `src/components/organisms/summary/*Section.tsx`, `src/components/atoms/CollapsibleCard.tsx`, `src/components/atoms/LiveToast.tsx`
- Modify: `src/theme/index.css` (remove rules only those components used), `eslint.config.js` (drop `src/pages/Dashboard.tsx` from ignores), `CLAUDE.md` (frontend section)
- Test: full suite + e2e

**Interfaces:** none new.

- [ ] **Step 1: Confirm nothing else imports them**

Run for each file to delete: `grep -rn "<ComponentName>" src --include=*.ts --include=*.tsx | grep -v "^src/components/organisms/<ComponentName>"`
Expected: no results except the file itself, the legacy `Dashboard.tsx` (also being deleted) and shims. `ConstituencyDetail.tsx` still uses `ConstituencyModalSubComponents`, `CandidateTable`, `CandidateCard` — **keep those**. Keep `summary/utils.tsx` if `ConstituencyDetail` imports it. Keep tests that import moved model code; delete only tests whose subject file is deleted (e.g. none of the current `src/__tests__` files — they test model code).

- [ ] **Step 2: Delete and clean CSS**

```bash
git rm src/pages/Dashboard.tsx src/components/organisms/AllianceTally.tsx src/components/organisms/ElectionSummary.tsx \
  src/components/organisms/WatchlistPanel.tsx src/components/organisms/KeyBattlesTicker.tsx src/components/organisms/ConstituencyModal.tsx \
  src/components/organisms/InteractiveMap.tsx src/components/organisms/MapControls.tsx src/components/organisms/MapLegend.tsx \
  src/components/organisms/StatesMiniMap.tsx src/components/atoms/CollapsibleCard.tsx src/components/atoms/LiveToast.tsx \
  src/components/organisms/summary/*Section.tsx
```
In `src/theme/index.css`, delete selectors that no remaining legacy file references: for each class (`grep -o '^\.[a-z-]*' src/theme/index.css | sort -u`), run `grep -rn "<class>" src --include=*.tsx` and delete the rule when there is no match.

- [ ] **Step 3: Update `CLAUDE.md`** — replace the Frontend line in "Tech Stack" with:
```markdown
- **Frontend:** React + TypeScript, Vite, D3.js (choropleth maps), i18next, Tailwind CSS v4 (preflight off) + Radix UI. Dashboard is MVVM: `src/model` (pure, no React) → `src/viewmodels` (hooks) → `src/views` (presentational), composed in `src/pages/StudioDashboard.tsx`; `npm run lint` enforces the import direction.
```

- [ ] **Step 4: Run everything** — `npx vitest run && npx tsc --noEmit && npm run lint && npm run build && npm run e2e` → all PASS; legacy constituency and person pages still open from the seat panel's "View full page" link.

- [ ] **Step 5: Commit**

```bash
git add -A src ../CLAUDE.md eslint.config.js
git commit -m "Remove the legacy dashboard after studio parity"
```
