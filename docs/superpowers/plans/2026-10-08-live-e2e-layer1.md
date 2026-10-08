# Live dashboard e2e, layer 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run e2e:live` (in `frontend/`) plays a simulated counting day through the real worker and checks, at
each checkpoint, that the dashboard shows what the backend snapshot of that version says, saving screenshots.

**Architecture:** A separate Playwright config whose global setup clones the sim election, sets it Live through the
admin API (baseline computed), and starts the mock ECI and the worker as child processes. The spec steps the mock one
round at a time, waits until the backend snapshot matches the mock and the page has rendered that version, then checks
the page against the snapshot. Three small test hooks are added to the views (`data-seat`, `data-chip`,
`data-live-version`).

**Tech Stack:** Playwright 1.x (`@playwright/test`), TypeScript, Node child processes, the existing scraper simulation
(`scraper/src/simulation`), NestJS admin API.

**Spec:** `docs/superpowers/specs/2026-10-08-live-e2e-layer1-design.md`

## Global Constraints

- Local only; never in CI. The preflight refuses a `DATABASE_URL` whose host is not `localhost` / `127.0.0.1`.
- Backend :3082 (started with `THROTTLE_PUBLIC_PER_MIN=100000`), frontend :3080, mock ECI :4444.
- Sim election `e1e1e1e1-2027-4000-a000-000000000027`; source Bihar 2025 `c3d4e5f6-a7b8-9012-cdef-234567890abc`;
  `TOTAL_ROUNDS = 24`.
- No fixed sleeps for state: wait on conditions. Backend settle timeout 60 s per round.
- Assertions compare the page with the backend snapshot of the same version, never hardcoded numbers.
- Screenshots: `frontend/e2e/artifacts/live/<checkpoint>-<viewport>.png` (gitignored); not pixel-compared.
- Failure messages name the checkpoint and both values (e.g. "C2: Too close chip says 14, snapshot says 17").
- `npm run e2e` (main suite) must not run the live spec (`testIgnore: 'live/**'`).
- `KEEP_SIM=1` skips the final `sim:cleanup`.
- Views may only import viewmodel types (`npm run lint`); test hooks are plain attributes.

## Review Focus

1. A run interrupted mid-way (Ctrl-C, a failed assertion) leaves a Live sim election, holds and child processes
   behind: the next run must still start clean (setup runs `sim:cleanup` first; teardown always kills children).
2. A port already taken (a stray mock ECI from a previous run) must fail the preflight with a clear message, not
   produce a second mock and a confusing settle timeout.
3. The worker lagging or dying mid-run must fail at that round with the lagging seat list (and the worker log path),
   not at the 15-minute test timeout.
4. The viewer poll (10 s + jitter) must not race the checks: every checkpoint waits for `data-live-version` to equal
   the settled backend version before reading the DOM.
5. Held seats (the test's corrections) must be excluded from the settle check and their corrected votes must survive
   later rounds (the worker must not overwrite a held seat).

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/views/map/MapCanvas.tsx` (modify) | `data-seat=<const_id>` on every `path.pc` |
| `frontend/src/views/dashboard/LayerInsightStrip.tsx` (modify) | `data-chip=<chip id>` on every chip button |
| `frontend/src/pages/StudioDashboard.tsx` (modify) | `data-live-version=<rendered snapshot version>` on the dashboard root |
| `frontend/playwright.live.config.ts` (create) | live suite config |
| `frontend/playwright.config.ts` (modify) | `testIgnore: 'live/**'` |
| `frontend/e2e/live/env.ts` (create) | constants, `.env` reader, admin token |
| `frontend/e2e/live/preflight.ts` (create) | checks prerequisites |
| `frontend/e2e/live/procs.ts` (create) | start/stop mock ECI and worker, pid file |
| `frontend/e2e/live/global-setup.ts`, `global-teardown.ts` (create) | sim lifecycle |
| `frontend/e2e/live/sim.ts` (create) | advance, settle, snapshot, corrections, status, viewer wait |
| `frontend/e2e/live/counting-day.spec.ts` (create) | checkpoints |
| `frontend/package.json`, `frontend/.gitignore` (modify) | script, artifacts |
| `docs/LIVE_RUNBOOK.md`, `docs/FEATURES.md`, `CLAUDE.md` (modify) | how and when to run |

---

### Task 1: Test hooks on the dashboard

**Files:**
- Modify: `frontend/src/views/map/MapCanvas.tsx` (fill effect, ~line 41–57)
- Modify: `frontend/src/views/dashboard/LayerInsightStrip.tsx` (`Chip`, line 10)
- Modify: `frontend/src/pages/StudioDashboard.tsx` (root element) and, if needed, `frontend/src/viewmodels/sources/useDashboardSources.ts`
- Test: `frontend/src/views/map/__tests__/MapCanvas.test.tsx`, `frontend/src/views/__tests__/layerInsightStrip.test.tsx` (create if absent), the StudioDashboard/sources test that already renders a snapshot (find with `grep -rl "useDashboardSources" frontend/src --include=*.test.*`)

**Interfaces:**
- Produces: `path.pc[data-seat="<const_id>"]`; `button[data-chip="<InsightChip.id>"]` (ids as built in `model/derive/layerInsights.ts`, e.g. the too-close chip id and the Battle `mo_switched` / `mo_narrowing` / `mo_widening` ids); `[data-live-version="<n>"]` on the dashboard root, `""` before the first snapshot.

- [ ] **Step 1: Write the failing tests**

In `MapCanvas.test.tsx`, next to the existing `data-pulse` test, render with the same fixture and assert:

```tsx
it('tags each seat path with its const_id', async () => {
  const { container } = renderCanvas(/* existing fixture with seat ids */);
  await waitFor(() => expect(container.querySelectorAll('path.pc[data-seat]').length).toBeGreaterThan(0));
  const ids = [...container.querySelectorAll('path.pc[data-seat]')].map(p => p.getAttribute('data-seat'));
  expect(ids).toContain(/* a const_id from the fixture */);
});
```

(Use the file's existing render helper and fixture ids; do not add a new fixture.)

In `layerInsightStrip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { LayerInsightStrip } from '../dashboard/LayerInsightStrip';

it('tags each chip with its id', () => {
  const vm = { insight: { headline: 'h', chips: [{ id: 'too_close', label: 'Too close', count: 3, color: '#fff' }] },
    lockedChipId: null, onLockChip: () => {}, onHoverChip: () => {}, onFocus: () => {} } as any;
  const { container } = render(<LayerInsightStrip vm={vm} variant="tile" />);
  expect(container.querySelector('button[data-chip="too_close"]')).toBeTruthy();
});
```

(Adjust `vm`/`insight` field names to the real `LayerInsightVM` type; wrap in the i18n provider the other view tests use.)

For `data-live-version`: in the existing dashboard/sources test that feeds a snapshot, assert the root carries
`data-live-version` equal to that snapshot's `version`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && npx vitest run src/views/map/__tests__/MapCanvas.test.tsx src/views/__tests__/layerInsightStrip.test.tsx`
Expected: FAIL (attribute missing).

- [ ] **Step 3: Implement**

MapCanvas fill effect, in the chain on `el`:

```tsx
        .attr('data-seat', id ?? null)
```

LayerInsightStrip `Chip` button: add `data-chip={c.id}`.

StudioDashboard root: `data-live-version={sources.liveVersion ?? ''}`. If `DashboardSources` has no rendered version,
add `liveVersion: number | null` to it in `useDashboardSources.ts`, set from the snapshot passed to `onSnapshot`
(the same place `liveStep` runs).

- [ ] **Step 4: Run tests, lint**

Run: `cd frontend && npx vitest run && npm run lint`
Expected: all pass; lint clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src && git commit -m "test(dashboard): data-seat, data-chip and data-live-version hooks for the live e2e"
```

---

### Task 2: Live suite harness and C0 (with the simulation refresh)

**Files:**
- Create: `frontend/playwright.live.config.ts`, `frontend/e2e/live/{env,preflight,procs,global-setup,global-teardown,sim}.ts`, `frontend/e2e/live/counting-day.spec.ts`
- Modify: `frontend/playwright.config.ts`, `frontend/package.json`, `frontend/.gitignore`
- Possibly modify: `scraper/src/simulation/{setup,reset,cleanup}.ts` (stale bits found by the first run)

**Interfaces:**
- Consumes: Task 1 hooks.
- Produces (in `e2e/live/sim.ts`):
  - `type Snapshot = { version: number; results: ResultRow[]; summary: Alliance[]; seats?: Record<string, { state: string; cr: number | null; tr: number | null }>; trail?: Record<string, unknown> }`
  - `api(request): Promise<Api>` with `get(path)`, `admin(method, path, data?)`
  - `liveState(request): Promise<{ version: number; status: string; declared: number; total: number }>`
  - `snapshot(request, version): Promise<Snapshot>`
  - `advance(): Promise<number>` (mock round)
  - `settle(request, excluded: Set<string>): Promise<Snapshot>`
  - `waitForViewer(page, version): Promise<void>`
  - `setStatus(request, status: 'Upcoming' | 'Live' | 'Finalized')`
  - `correct(request, constId, state, votes)`; `releaseHold(request, constId)`
  - `shot(page, checkpoint, viewport)`
  - `constIdOf(constNo: number): string` (`BR_VS27_<no padded as in setup>`)

- [ ] **Step 1: Ignore the live folder in the main suite; add config, script, gitignore**

`frontend/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: 'e2e', testIgnore: 'live/**', use: { baseURL: 'http://localhost:3080' }, reporter: 'list' });
```

`frontend/playwright.live.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e/live',
  workers: 1,
  fullyParallel: false,
  timeout: 15 * 60_000,
  globalSetup: './e2e/live/global-setup.ts',
  globalTeardown: './e2e/live/global-teardown.ts',
  use: { baseURL: 'http://localhost:3080', colorScheme: 'dark' },
  reporter: 'list',
});
```

`package.json` scripts: `"e2e:live": "playwright test -c playwright.live.config.ts"`. `.gitignore`: `e2e/artifacts/`.

- [ ] **Step 2: `env.ts`**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(__dirname, '../../..');
export const SCRAPER = join(ROOT, 'scraper');
export const ARTIFACTS = join(__dirname, '../artifacts/live');
export const API = 'http://localhost:3082/api/v1';
export const MOCK = 'http://localhost:4444';
export const SIM = 'e1e1e1e1-2027-4000-a000-000000000027';
export const TOTAL_ROUNDS = 24;

/** Root .env then backend/.env (first wins), overridden by process.env. */
export function fileEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of [join(ROOT, '.env'), join(ROOT, 'backend/.env')]) {
    try {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
        if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* absent */ }
  }
  return { ...env, ...(process.env as Record<string, string>) };
}

export async function adminToken(): Promise<string> {
  const env = fileEnv();
  if (env.E2E_ADMIN_TOKEN) return env.E2E_ADMIN_TOKEN;
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) throw new Error('no admin credentials: set E2E_ADMIN_TOKEN or ADMIN_EMAIL/ADMIN_PASSWORD');
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }) });
  if (!res.ok) throw new Error(`admin login failed: HTTP ${res.status}`);
  return ((await res.json()) as { data: { access_token: string } }).data.access_token;
}
```

- [ ] **Step 3: `preflight.ts`**

```ts
import { API, fileEnv, MOCK } from './env';

async function up(url: string): Promise<boolean> {
  try { return (await fetch(url)).ok; } catch { return false; }
}

export async function preflight(): Promise<void> {
  const env = fileEnv();
  const db = env.DATABASE_URL ?? '';
  const host = /@([^:/]+)/.exec(db)?.[1];
  if (!host || !['localhost', '127.0.0.1'].includes(host)) throw new Error(`preflight: DATABASE_URL host is "${host ?? 'unset'}"; the live e2e runs only against a local database`);
  if (!(await up(`${API}/health/ready`))) throw new Error('preflight: backend not ready on :3082 (start it with THROTTLE_PUBLIC_PER_MIN=100000)');
  if (!(await up('http://localhost:3080'))) throw new Error('preflight: frontend not running on :3080 (cd frontend && npm run dev)');
  if (await up(`${MOCK}/status`)) throw new Error('preflight: something already listens on :4444 (a stray mock ECI?); stop it first');
}
```

- [ ] **Step 4: `procs.ts`**

Spawns with the root `.env` merged into the child env, writes pids to `ARTIFACTS/pids.json`, logs to
`ARTIFACTS/{mock-eci,worker}.log`, and waits for readiness.

```ts
import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ARTIFACTS, fileEnv, MOCK, SCRAPER } from './env';

const PIDS = join(ARTIFACTS, 'pids.json');

function start(name: string, script: string): ChildProcess {
  mkdirSync(ARTIFACTS, { recursive: true });
  const log = createWriteStream(join(ARTIFACTS, `${name}.log`));
  const child = spawn('npm', ['run', script], { cwd: SCRAPER, env: fileEnv(), detached: true });
  child.stdout?.pipe(log); child.stderr?.pipe(log);
  return child;
}

export async function startSim(): Promise<void> {
  const mock = start('mock-eci', 'sim:mock-eci');
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${MOCK}/status`)).ok) break; } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  if (Date.now() >= deadline) throw new Error(`mock ECI did not start; see ${join(ARTIFACTS, 'mock-eci.log')}`);
  const worker = start('worker', 'sim:live');
  writeFileSync(PIDS, JSON.stringify([mock.pid, worker.pid]));
}

/** Kills the process groups started by startSim (also after a crashed run). */
export function stopSim(): void {
  if (!existsSync(PIDS)) return;
  for (const pid of JSON.parse(readFileSync(PIDS, 'utf8')) as number[]) {
    try { process.kill(-pid, 'SIGTERM'); } catch { /* gone */ }
  }
  writeFileSync(PIDS, '[]');
}
```

- [ ] **Step 5: `sim.ts`**

```ts
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { join } from 'node:path';
import { adminToken, API, ARTIFACTS, MOCK, SIM } from './env';
import type { ResultRow, Alliance } from '../../src/model/types';

export type SeatState = { state: string; cr: number | null; tr: number | null };
export type Snapshot = { version: number; results: ResultRow[]; summary: Alliance[]; seats?: Record<string, SeatState>; trail?: Record<string, unknown> };
export type LiveDoc = { version: number; status: string; declared: number; total: number };

let token: string | null = null;
async function auth() { token ??= await adminToken(); return { Authorization: `Bearer ${token}` }; }

export async function liveState(request: APIRequestContext): Promise<LiveDoc> {
  const res = await request.get(`${API}/elections/${SIM}/live`);
  expect(res.ok(), `GET /live HTTP ${res.status()}`).toBe(true);
  return ((await res.json()) as { data: LiveDoc }).data;
}

export async function snapshot(request: APIRequestContext, version: number): Promise<Snapshot> {
  const res = await request.get(`${API}/elections/${SIM}/results?v=${version}`);
  expect(res.ok(), `GET results?v=${version} HTTP ${res.status()}`).toBe(true);
  return ((await res.json()) as { data: Snapshot }).data;
}

export async function advance(): Promise<number> {
  const res = await fetch(`${MOCK}/advance-round`, { method: 'POST' });
  return ((await res.json()) as { round: number }).round;
}

export async function mockReset(): Promise<void> { await fetch(`${MOCK}/reset`, { method: 'POST' }); }

/** const_no → { currentRound, totalRounds } for seats that have started. */
async function mockSeats(): Promise<Record<string, { currentRound: number; totalRounds: number }>> {
  return (await (await fetch(`${MOCK}/status/constituencies`)).json()) as Record<string, { currentRound: number; totalRounds: number }>;
}

/** Sim const ids are the source ids with BR_VS_ → BR_VS27_ (scraper/src/simulation/setup.ts). */
export function constNoOf(constId: string): number { return Number(/(\d+)$/.exec(constId)![1]); }

/**
 * Waits until every started, non-excluded seat in the latest snapshot is at the mock's round
 * (declared when the mock's seat is at its last round) and the version held still for one poll.
 */
export async function settle(request: APIRequestContext, excluded: Set<string>, label: string): Promise<Snapshot> {
  const deadline = Date.now() + 60_000;
  let lastVersion = -1;
  let lagging: string[] = [];
  while (Date.now() < deadline) {
    const want = await mockSeats();
    const live = await liveState(request);
    if (live.version === lastVersion && live.version > 0) {
      const snap = await snapshot(request, live.version);
      const byNo = new Map(Object.entries(snap.seats ?? {}).map(([id, s]) => [constNoOf(id), { id, s }]));
      lagging = [];
      for (const [no, w] of Object.entries(want)) {
        const got = byNo.get(Number(no));
        if (got && excluded.has(got.id)) continue;
        const ok = got && (w.currentRound >= w.totalRounds ? got.s.state === 'declared' : got.s.cr === w.currentRound);
        if (!ok) lagging.push(`${no}(mock ${w.currentRound}/${w.totalRounds}, api ${got ? `${got.s.state} ${got.s.cr}` : 'none'})`);
      }
      if (lagging.length === 0) return snap;
    }
    lastVersion = live.version;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`${label}: backend not settled after 60 s; lagging seats: ${lagging.slice(0, 15).join(', ')}${lagging.length > 15 ? ` (+${lagging.length - 15})` : ''}; worker log ${join(ARTIFACTS, 'worker.log')}`);
}

/** Advances the mock to `round`, settling after every step. */
export async function advanceTo(request: APIRequestContext, round: number, excluded: Set<string>): Promise<Snapshot> {
  let snap: Snapshot | null = null;
  let r = (await (await fetch(`${MOCK}/status`)).json() as { currentRound: number }).currentRound;
  while (r < round) { r = await advance(); snap = await settle(request, excluded, `round ${r}`); }
  return snap ?? await snapshot(request, (await liveState(request)).version);
}

/** The page has rendered snapshot `version` (Task 1 hook). Viewer poll is 10 s + jitter, so allow 40 s. */
export async function waitForViewer(page: Page, version: number): Promise<void> {
  await expect(page.locator(`[data-live-version="${version}"]`), `viewer did not render version ${version}`).toHaveCount(1, { timeout: 40_000 });
}

export async function setStatus(request: APIRequestContext, status: 'Upcoming' | 'Live' | 'Finalized'): Promise<void> {
  const res = await request.patch(`${API}/admin/elections/${SIM}`, { headers: await auth(), data: { status } });
  expect(res.ok(), `set ${status}: HTTP ${res.status()}`).toBe(true);
}

export async function correct(request: APIRequestContext, constId: string, state: string, votes: Record<string, number>): Promise<void> {
  const res = await request.put(`${API}/admin/elections/${SIM}/seats/${constId}`, { headers: await auth(), data: { state, votes } });
  expect(res.ok(), `correct ${constId} ${state}: HTTP ${res.status()} ${await res.text()}`).toBe(true);
}

export async function releaseHold(request: APIRequestContext, constId: string): Promise<void> {
  await request.delete(`${API}/admin/elections/${SIM}/holds/${constId}`, { headers: await auth() });
}

/** Admin per-seat roster (candidate ids, votes) for corrections. */
export async function adminSeats(request: APIRequestContext): Promise<{ const_id: string; seat_state?: string | null; candidates: { candidate_id: string; party_id: string; votes: number; status: string }[] }[]> {
  const res = await request.get(`${API}/admin/elections/${SIM}/live-results`, { headers: await auth() });
  return ((await res.json()) as { data: any[] }).data;
}

export async function shot(page: Page, checkpoint: string, viewport: string): Promise<void> {
  await page.screenshot({ path: join(ARTIFACTS, `${checkpoint}-${viewport}.png`) });
}
```

- [ ] **Step 6: `global-setup.ts` / `global-teardown.ts`**

```ts
// global-setup.ts
import { execSync } from 'node:child_process';
import { fileEnv, SCRAPER } from './env';
import { preflight } from './preflight';
import { startSim, stopSim } from './procs';
import { request as pwRequest } from '@playwright/test';
import { setStatus } from './sim';

export default async function globalSetup(): Promise<void> {
  stopSim(); // leftovers of a crashed run
  await preflight();
  const opts = { cwd: SCRAPER, env: fileEnv(), stdio: 'inherit' as const };
  execSync('echo y | npm run sim:cleanup', opts);
  execSync('npm run sim:setup', opts);
  const request = await pwRequest.newContext();
  await setStatus(request, 'Upcoming');
  await setStatus(request, 'Live'); // computes the baseline (admin-elections.controller computeIfLive)
  await request.dispose();
  await startSim();
}
```

```ts
// global-teardown.ts
import { execSync } from 'node:child_process';
import { fileEnv, SCRAPER } from './env';
import { stopSim } from './procs';

export default async function globalTeardown(): Promise<void> {
  stopSim();
  if (process.env.KEEP_SIM === '1') return;
  execSync('echo y | npm run sim:cleanup', { cwd: SCRAPER, env: fileEnv(), stdio: 'inherit' });
}
```

(Holds are rows of the sim election; `sim:cleanup` deletes them with it. If cleanup does not cover the hold table,
add it to its table list — that is part of this task's sim refresh.)

- [ ] **Step 7: C0 in `counting-day.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test';
import { SIM } from './env';
import { liveState, shot, waitForViewer } from './sim';

test.describe.configure({ mode: 'serial' });

let navigations = 0;
function countNavigations(page: Page) { page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; }); }

test('counting day, desktop', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  countNavigations(page);

  // C0: Live, nothing counted.
  const live0 = await liveState(request);
  expect(live0.status, 'C0: status').toBe('Live');
  expect(live0.declared, 'C0: declared').toBe(0);
  await page.goto(`/election/${SIM}`);
  await expect(page.getByText('Waiting for updates'), 'C0: waiting line').toBeVisible({ timeout: 30_000 });
  await expect(page.locator('path.pc[data-seat]').first()).toBeAttached({ timeout: 30_000 });
  const filled = await page.locator('path.pc[data-seat]').evaluateAll(ps => ps.filter(p => (p as SVGPathElement).style.fill !== 'var(--color-map-pending)').length);
  expect(filled, 'C0: seats coloured before any result').toBe(0);
  await page.getByRole('button', { name: /^Choose election/ }).click();
  await expect(page.getByRole('option', { name: /2027 \(Simulation\)|Simulation/ }).first(), 'C0: picker lists the Live election').toBeVisible();
  await page.keyboard.press('Escape');
  await shot(page, 'C0', 'desktop');
});
```

(`waitForViewer` is not used at C0: with no snapshot yet the version attribute is `""`/0. Confirm the picker's
pinned-Live marker in `views/dashboard/ElectionPicker.tsx` and assert it, not just presence.)

- [ ] **Step 8: Run; refresh the simulation until C0 passes**

Run (backend started with `THROTTLE_PUBLIC_PER_MIN=100000`, frontend running): `cd frontend && npm run e2e:live`
Expected: first run may fail on stale simulation bits (e.g. setup not copying a column the dashboard now needs,
regions, the manifest). Fix each in `scraper/src/simulation/*` as its own commit (`fix(sim): …`), rerun until C0
passes. Confirm `npm run e2e -- --list | grep -c live` prints `0`.

- [ ] **Step 9: Commit**

```bash
git add frontend/playwright*.ts frontend/package.json frontend/.gitignore frontend/e2e/live
git commit -m "test(e2e): live counting-day harness (mock ECI + worker) and the before-results checkpoint"
```

---

### Task 3: C1 and C2 (first leads, mid-count)

**Files:**
- Modify: `frontend/e2e/live/counting-day.spec.ts`
- Possibly modify: product code for real bugs found (each with a failing unit test first, own commit)

**Interfaces:**
- Consumes: `advanceTo`, `waitForViewer`, `snapshot`, `shot` from Task 2; `analyseLive`, `baselineOf`-shaped baseline from `frontend/src/model/derive/seatAnalysis` (import directly; it is pure).
- Produces: helpers in the spec file: `leadersOf(snap): Map<string, { party: string; won: boolean }>`, `excluded: Set<string>` (shared through the test).

- [ ] **Step 1: Write C1 and C2 checks (append inside the desktop test)**

```ts
  // shared through the test
  const excluded = new Set<string>();
  const leadersOf = (snap: Snapshot) => {
    const m = new Map<string, { party: string; won: boolean; votes: number }>();
    for (const r of snap.results) {
      const cur = m.get(r.const_id);
      if (r.votes > 0 && (!cur || r.votes > cur.votes)) m.set(r.const_id, { party: r.party_id, won: r.status === 'WON', votes: r.votes });
    }
    return m;
  };

  // C1: first leads.
  let snap = await advanceTo(request, 2, excluded);
  await waitForViewer(page, snap.version);
  const lead1 = leadersOf(snap);
  const coloured1 = await page.locator('path.pc[data-seat]').evaluateAll(ps => ps.filter(p => (p as SVGPathElement).style.fill !== 'var(--color-map-pending)').map(p => p.getAttribute('data-seat')));
  expect(new Set(coloured1), 'C1: coloured seats = seats with a leader in the snapshot').toEqual(new Set(lead1.keys()));
  await expect(page.getByText(/leads in/).first(), 'C1: ticker has a lead line').toBeVisible();
  await shot(page, 'C1', 'desktop');

  // C2: mid-count, with the pulse watched from round 6.
  let sawSwitchPulse = false;
  await page.exposeFunction('__pulse', (kind: string) => { if (kind === 'switch') sawSwitchPulse = true; });
  await page.evaluate(() => new MutationObserver(ms => ms.forEach(m => {
    const v = (m.target as Element).getAttribute('data-pulse'); if (v) (window as any).__pulse(v);
  })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-pulse'] }));
  for (let r = 3; r <= 8; r++) { snap = await advanceTo(request, r, excluded); await waitForViewer(page, snap.version); }
  expect(sawSwitchPulse, 'C2: a switch pulse appeared after a lead switch').toBe(true);

  // Overview: dashed seats = Too close chip count.
  await page.getByRole('radio', { name: 'Summary · Overview' }).click().catch(() => {});
  const dashed = await page.locator('path.pc[data-seat]').evaluateAll(ps => ps.filter(p => (p as SVGPathElement).style.strokeDasharray === '3 2').length);
  const chip = page.locator('button[data-chip="too_close"]');
  if (dashed > 0) {
    await expect(chip, 'C2: Too close chip shown when seats are dashed').toBeVisible();
    expect(Number(await chip.locator('span').last().textContent()), `C2: Too close chip vs dashed seats`).toBe(dashed);
  }
  await shot(page, 'C2', 'desktop');

  // Battle: "N lead changes so far" and a switched seat's dialog.
  await page.getByRole('radio', { name: 'Battle', exact: true }).click();
  await expect(page.getByText(/\d+ lead changes so far/), 'C2: Battle live headline').toBeVisible();
  const switched = await page.locator('button[data-chip="mo_switched"]').count();
  expect(switched, 'C2: Battle has a Lead switched chip').toBe(1);
  await shot(page, 'C2-battle', 'desktop');
```

Replace the chip ids (`too_close`, `mo_switched`) with the exact ids from `model/derive/layerInsights.ts`, and the
layer radio names with the ones `MapTile` renders (the main e2e uses `radio` names like `'Swing'`). Then the switched
seat's dialog:

```ts
  const switchedSeat = Object.entries(snap.trail ?? {}).find(([, t]) => (t as any).lc > 0)?.[0];
  expect(switchedSeat, 'C2: snapshot has a seat with a lead change').toBeTruthy();
  await page.locator(`path.pc[data-seat="${switchedSeat}"]`).dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('svg[data-margin-trend]'), 'C2: margin trend in the dialog').toBeVisible();
  await expect(dialog.getByText(/Round \d+ of \d+/), 'C2: round line').toBeVisible();
  await shot(page, 'C2-dialog', 'desktop');
  await page.keyboard.press('Escape');
```

(Confirm the trail field for lead changes is `lc` in `backend` snapshot code — summary: trail has `lc`, `pk`, `md`.)

Person page during counting (new tab, so the dashboard keeps its one navigation):

```ts
  const counting = snap.results.find(r => r.person_id && snap.seats?.[r.const_id]?.state === 'counting');
  const person = await page.context().newPage();
  await person.goto(`/person/${counting!.person_id}`);
  await expect(person.getByText(/Counting|Leading|Trailing/).first(), 'C2: person page shows the live state').toBeVisible({ timeout: 20_000 });
  await shot(person, 'C2-person', 'desktop');
  await person.close();
```

- [ ] **Step 2: Run**

Run: `cd frontend && npm run e2e:live`
Expected: C0–C2 pass, or a failure that names a checkpoint. For each failure decide: test selector wrong (fix the
test) or product wrong (failing unit test in `src/…`, fix, own commit `fix(live): …`). Record each product bug in the
commit message.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/live && git commit -m "test(e2e): live checkpoints C1 (first leads) and C2 (mid-count: too close, battle, pulse, dialog, person page)"
```

---

### Task 4: C3 and C4 (special seat states, partial declarations)

**Files:**
- Modify: `frontend/e2e/live/counting-day.spec.ts`

**Interfaces:**
- Consumes: `adminSeats`, `correct`, `releaseHold`, `advanceTo`, `waitForViewer`, `excluded`.

- [ ] **Step 1: Write C3 and C4**

```ts
  // C3: special states at round 10 (seats still counting).
  snap = await advanceTo(request, 10, excluded);
  const roster = await adminSeats(request);
  const countingIds = roster.filter(s => snap.seats?.[s.const_id]?.state === 'counting' && s.candidates.length >= 2).map(s => s.const_id);
  const [cmId, adjId, heldId] = countingIds;
  const rosterVotes = (id: string, over: Record<string, number> = {}) =>
    Object.fromEntries(roster.find(s => s.const_id === id)!.candidates.map(c => [c.candidate_id, over[c.candidate_id] ?? c.votes]));
  const heldSeat = roster.find(s => s.const_id === heldId)!;
  const [hA, hB] = [...heldSeat.candidates].sort((a, b) => b.votes - a.votes);
  const heldVotes = rosterVotes(heldId, { [hB.candidate_id]: hA.votes + 777 });
  for (const id of [cmId, adjId, heldId]) excluded.add(id);
  try {
    await correct(request, cmId, 'countermanded', rosterVotes(cmId));
    await correct(request, adjId, 'adjourned', rosterVotes(adjId));
    await correct(request, heldId, 'counting', heldVotes);
    const v3 = (await liveState(request)).version;
    await waitForViewer(page, v3);
    for (const [id, text] of [[cmId, 'Countermanded'], [adjId, 'Counting adjourned']] as const) {
      await page.locator(`path.pc[data-seat="${id}"]`).dispatchEvent('click');
      await expect(page.getByRole('dialog').getByText(text), `C3: ${id} dialog says ${text}`).toBeVisible();
      await shot(page, `C3-${text.split(' ')[0].toLowerCase()}`, 'desktop');
      await page.keyboard.press('Escape');
    }

    // C4: partial declarations at round 18; the held seat keeps its corrected votes.
    snap = await advanceTo(request, 18, excluded);
    await waitForViewer(page, snap.version);
    const heldRows = snap.results.filter(r => r.const_id === heldId);
    const runnerUp = heldRows.find(r => r.candidate_name === hB.candidate_name /* or by party */);
    expect(runnerUp?.votes, 'C4: held seat keeps the corrected votes').toBe(hA.votes + 777);
    const declared = new Set([...leadersOf(snap)].filter(([, l]) => l.won).map(([id]) => id));
    expect(declared.size, 'C4: some seats declared by round 18').toBeGreaterThan(0);
    // Standings: each party's won + leading equals the snapshot summary (Alliance rows).
    for (const a of snap.summary.slice(0, 3)) {
      const row = page.getByRole('radiogroup', { name: 'Party Standings' }).getByText(a.name ?? a.id, { exact: false }).first();
      await expect(row, `C4: standings row for ${a.id}`).toBeVisible();
    }
    await expect(page.getByText(/ wins /).first(), 'C4: ticker has a won line').toBeVisible();
    await shot(page, 'C4', 'desktop');

    // Constituency pages of a declared and a counting seat (new tab).
    const cp = await page.context().newPage();
    for (const id of [[...declared][0], countingIds[3]]) {
      await cp.goto(`/election/${SIM}/constituency/${id}`);
      await expect(cp.getByRole('heading', { level: 1 }), `C4: constituency page ${id}`).toBeVisible({ timeout: 20_000 });
      await shot(cp, `C4-constituency-${snap.seats?.[id]?.state}`, 'desktop');
    }
    await cp.close();
  } finally {
    for (const id of [cmId, adjId, heldId]) if (id) await releaseHold(request, id);
  }
```

Field names to confirm before running: the `Alliance` summary fields (`model/types` `Alliance`: id/name/seats or
won/leading) — assert the Standings numbers against `won + leading` from the snapshot summary using the row text; the
candidate matching for the held seat (use `party_id` if names differ between admin and public rows).

Note on the held seat: releasing its hold in `finally` happens after C4 — by then the check has run. Countermanded and
adjourned stay excluded from settling until the end.

- [ ] **Step 2: Run**

Run: `cd frontend && npm run e2e:live`
Expected: C0–C4 pass, or failures handled as in Task 3 Step 2.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/live && git commit -m "test(e2e): live checkpoints C3 (countermanded, adjourned, held) and C4 (partial declarations, standings, constituency pages)"
```

---

### Task 5: C5 and C6 (all declared, Finalized) and the single-load check

**Files:**
- Modify: `frontend/e2e/live/counting-day.spec.ts`

- [ ] **Step 1: Write C5 and C6**

```ts
  // C5: all declared (the two special seats never declare; exclude them from the count).
  snap = await advanceTo(request, 24, excluded);
  await waitForViewer(page, snap.version);
  const live5 = await liveState(request);
  expect(live5.declared, 'C5: declared = total minus countermanded/adjourned').toBe(live5.total - 2);
  const dashed5 = await page.locator('path.pc[data-seat]').evaluateAll(ps => ps.filter(p => (p as SVGPathElement).style.strokeDasharray === '3 2').length);
  expect(dashed5, 'C5: no too-close dashes').toBe(0);
  await expect(page.getByText(/lead changes so far/), 'C5: Battle back to margin buckets').toHaveCount(0);
  await shot(page, 'C5', 'desktop');
  expect(navigations, 'C0–C5: the page was loaded once').toBe(1);

  // C6: Finalized.
  await setStatus(request, 'Finalized');
  await expect(page.getByText('Live', { exact: true }), 'C6: Live chip gone').toHaveCount(0, { timeout: 90_000 });
  await shot(page, 'C6', 'desktop');
```

Note: with a countermanded and an adjourned seat, C5's "all declared" is "all except those two" — correct the spec's
wording in the same commit (spec §4 C5 row: "declared = total − countermanded − adjourned"). If `countingLive` stays
true because those two seats are not declared, that is a product question: a countermanded/adjourned seat should not
keep the map in live styling. Check `countingLive` in `model/derive/seatAnalysis/live.ts`: it returns live only if
some seat's call is not declared/not_started. If the two seats keep it live, the fix (test first, in the shared module
on both sides) is to treat `countermanded` / `adjourned` as settled for `countingLive`.

The picker check after C6: open the picker and assert the sim election is no longer in the pinned-Live group (use the
marker found in Task 2 Step 7).

- [ ] **Step 2: Run, commit**

Run: `cd frontend && npm run e2e:live`. Expected: C0–C6 pass.

```bash
git add frontend/e2e/live docs/superpowers/specs/2026-10-08-live-e2e-layer1-design.md && git commit -m "test(e2e): live checkpoints C5 (all declared) and C6 (Finalized), single page load"
```

---

### Task 6: Mobile pass and light-theme screenshot

**Files:**
- Modify: `frontend/e2e/live/counting-day.spec.ts`

**Interfaces:**
- Consumes: `mockReset`, `setStatus`, `advanceTo`, `waitForViewer`; `sim:reset` via `execSync` from `env.ts` paths.

- [ ] **Step 1: Write the mobile test (second test in the serial describe)**

```ts
test('counting day, mobile and light theme', async ({ page, request }) => {
  const opts = { cwd: SCRAPER, env: fileEnv(), stdio: 'inherit' as const };
  await mockReset();
  execSync('npm run sim:reset', opts);
  await setStatus(request, 'Upcoming');
  await setStatus(request, 'Live');
  const excluded = new Set<string>();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/election/${SIM}`);
  await expect(page.getByText('Waiting for updates'), 'M-C0: waiting line').toBeVisible({ timeout: 30_000 });
  await shot(page, 'C0', 'mobile');

  let snap = await advanceTo(request, 8, excluded);
  await waitForViewer(page, snap.version);
  await shot(page, 'C2', 'mobile');
  const seat = Object.keys(snap.seats ?? {}).find(id => snap.seats![id].state === 'counting')!;
  await page.locator(`path.pc[data-seat="${seat}"]`).dispatchEvent('click');
  await expect(page.getByRole('dialog').getByText(/Round \d+ of \d+/), 'M-C2: seat dialog on mobile').toBeVisible();
  await shot(page, 'C2-dialog', 'mobile');
  await page.keyboard.press('Escape');

  // Light theme at C2 (screenshot only).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await shot(page, 'C2-light', 'desktop');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  snap = await advanceTo(request, 24, excluded);
  await waitForViewer(page, snap.version);
  const live = await liveState(request);
  expect(live.declared, 'M-C5: all declared').toBe(live.total);
  await shot(page, 'C5', 'mobile');
});
```

Imports to add at the top of the spec: `execSync` from `node:child_process`; `SCRAPER`, `fileEnv` from `./env`;
`mockReset`, `setStatus`, `advanceTo`, `liveState`, `waitForViewer`, `shot` from `./sim`. Confirm `sim:reset` also
clears holds and seat states left by the desktop test (it clears `seat_rounds`, `seat_ingest_state`, rounds); if the
countermanded/adjourned states survive in `results`/`constituencies`, extend `reset.ts` (own commit `fix(sim): …`).
The worker keeps its lease across the reset; if it does not pick up from round 0, restart it here with
`stopSim(); await startSim();` (ruling, ledgered).

- [ ] **Step 2: Run, commit**

Run: `cd frontend && npm run e2e:live`. Expected: both tests pass; `e2e/artifacts/live/` holds C0–C6 desktop, C2
dialogs, C2 light, and mobile C0/C2/C5 screenshots.

```bash
git add frontend/e2e/live && git commit -m "test(e2e): live mobile pass and light-theme screenshot"
```

---

### Task 7: Docs

**Files:**
- Modify: `docs/LIVE_RUNBOOK.md` (§5 simulation), `docs/FEATURES.md` (live section), `CLAUDE.md` (frontend commands line)

- [ ] **Step 1: Write**

LIVE_RUNBOOK §5, a new subsection "Viewer e2e (layer 1)":

```markdown
Run before every release that touches the live path, and weekly from January 2027:

1. Postgres up; backend on :3082 with `THROTTLE_PUBLIC_PER_MIN=100000 npm run start:dev`; frontend on :3080.
2. `cd frontend && npm run e2e:live` (about 8 minutes). It clones the sim election, starts the mock ECI and the
   worker, plays 24 rounds, checks the dashboard at C0–C6 against the backend snapshot, then a mobile pass, and
   cleans up (`KEEP_SIM=1` keeps the sim election).
3. Review the screenshots in `frontend/e2e/artifacts/live/`; mock and worker logs are next to them.
```

FEATURES.md: one paragraph under the live dashboard section describing the suite, the checkpoints and the hooks
(`data-seat`, `data-chip`, `data-live-version`). CLAUDE.md frontend commands: add `npm run e2e:live` (live
counting-day e2e; backend with `THROTTLE_PUBLIC_PER_MIN=100000`).

- [ ] **Step 2: Commit**

```bash
git add docs CLAUDE.md && git commit -m "docs: live viewer e2e (layer 1) in the runbook, features and CLAUDE.md"
```
