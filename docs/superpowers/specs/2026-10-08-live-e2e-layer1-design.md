# Live dashboard e2e, layer 1: a simulated count seen by a viewer (design)

Status: **draft for review** (brainstorm 2026-10-08). Layer 1 of the live testing layers in
`2026-10-07-live-dashboard-testing-notes.md` §4. Layers 2–5 (slow network, background tab, Render restart, load, admin
drills on real hosting, the real ECI adapter) are out of scope.

## 1. Goal

One local command, `npm run e2e:live` (in `frontend/`), plays a whole counting day and checks, at each stage, that a
viewer's dashboard shows exactly what the API serves. Screenshots of every stage are saved for a person to review. It
runs locally only (no CI), before each release that touches the live path, and in the weeks before counting day
(27 Feb 2027).

## 2. What is driven, end to end

The full counting-day chain runs, nothing stubbed:

mock ECI (:4444, Bihar 2025 round snapshots) → the real worker (`sim:live`, adapter `mock-eci`, 3 s poll) → ingest
API → DB triggers (version bump, `seat_rounds`) → `/elections/:id/live` + `results?v=` → the dashboard polling in
Playwright's browser.

The mock's timeline is fixed: seats start counting in global rounds 1–4, close races flip their lead in rounds 6–12,
seats declare between rounds 16 and 24, and all are declared at round 24 (`TOTAL_ROUNDS`).

Countermanded, adjourned and held seats do not come from the mock; the test sets them through the admin seat
correction (`PUT /admin/elections/:id/seats/:constId`, states from `SEAT_STATES` in
`backend/src/modules/ingest/seat-rules.ts`), as an admin would on counting day. A correction places a hold.

## 3. The oracle

Assertions compare the page with the **backend snapshot of the same version**, read by the test itself (`/live`, then
`results?v=<version>`), never with hardcoded numbers. The test proves that the dashboard renders what the API serves,
and it survives changes to the mock's seeds or to Bihar's data. Seats used in checks (a switched seat, a too-close
seat, a declared seat, a counting seat) are picked from the snapshot at that checkpoint.

## 4. Checkpoints

Desktop, 1440×900, dark theme. The page is loaded once at C0; every later state must arrive by polling (the test
counts main-frame navigations: exactly one through C5).

| # | Mock round | State | Checks |
|---|---|---|---|
| C0 | 0, election Live | before results | Live chip; "Waiting for updates" / 0 declared; every seat pending on the map; tallies 0; no ticker events; the picker pins the election |
| C1 | 2 | first leads | "leading" tallies equal the snapshot; leading seats in party colour; not-started seats pending; the ticker has lead lines |
| C2 | 8 | mid-count | Overview: "Too close · N" chip with N from the snapshot (`analyseLive` on baseline + snapshot), dashed seats present; Battle: momentum fills and "N lead changes so far" with N from the snapshot; a switched seat's dialog: round bar, Switched badge, margin trend with ≥ 2 points; a `data-pulse="switch"` seen after a round with a switch; the person page of a candidate in a counting seat shows the live state |
| C3 | 10 | special states | the test corrects three seats: countermanded, adjourned, and a vote correction (held). Each seat's dialog and hover card show its state; the held seat keeps the corrected numbers through later rounds |
| C4 | 18 | partial declarations | alliance tally "won + leading" against the majority line equals the snapshot; declared seats solid; the ticker has won lines; the constituency page of a declared seat and of a counting seat |
| C5 | 24 | all declared | declared = total; no live styling on the map (`countingLive` false); Battle back to margin buckets |
| C6 | — | Finalized | the test sets the election Finalized (admin API); the Live chip is gone; the picker no longer pins it |

After the desktop run, a **mobile pass** at 390×844 repeats C0, C2 and C5 checks on a fresh replay (bottom card,
chips, seat dialog). A **light-theme** screenshot is taken at C2 (screenshot only).

Screenshots: `frontend/e2e/artifacts/live/<checkpoint>-<viewport>.png` (gitignored), one per checkpoint and viewport.
They are for review, not pixel comparison.

A failure message names the checkpoint and both values, e.g. "C2: Too close chip says 14, snapshot says 17".

## 5. Waiting for a round to settle

No fixed sleeps. Each step:

1. **Advance:** `POST /advance-round` on the mock.
2. **Backend settled:** poll every 500 ms until every started seat's `current_round` in the latest snapshot equals the
   mock's per-seat round (`GET /status/constituencies`) and the version has stopped changing for one poll. Seats the
   test put on hold are excluded. Timeout 60 s per round; a timeout fails with the list of lagging seats.
3. **Viewer settled:** wait for the page's request for `results?v=<that version>` (Playwright network listener), then
   for the DOM to show it (the declared count equals the snapshot's).

A full desktop run is expected to take 3–4 minutes.

## 6. Setup and teardown

**Prerequisites** (started by the developer, as for `npm run e2e`): Postgres; the backend on :3082 started with
`THROTTLE_PUBLIC_PER_MIN=100000` (the default 600/min causes 429s under the test's polling); the frontend on :3080;
admin credentials (`E2E_ADMIN_TOKEN` or `ADMIN_EMAIL` / `ADMIN_PASSWORD`, the existing e2e helper).

A **preflight** checks each, stops with a one-line fix when one is missing, and refuses a `DATABASE_URL` whose host is
not `localhost` / `127.0.0.1` (it can never touch Neon).

**Global setup:**
1. `sim:cleanup` if a sim election exists, then `sim:setup` (a fresh clone every run).
2. Set the sim election Upcoming, then Live, through the admin API. Going Live computes the baseline (counting-day
   path); `sim:setup` alone inserts it as Live and would skip that.
3. Start the mock ECI and the worker (`sim:live`) as child processes from `scraper/`, with `.env` loaded; their logs go
   to `e2e/artifacts/live/{mock-eci,worker}.log`.

Between the desktop and the mobile pass, the suite resets the mock (`POST /reset`), runs `sim:reset`, and sets the
election Live again.

**Global teardown:** stop both child processes; release the test's holds; run `sim:cleanup`. `KEEP_SIM=1` skips the
cleanup so the state can be inspected.

## 7. Files

- `frontend/playwright.live.config.ts`: `testDir: e2e/live`, one worker, not parallel, 10-minute test timeout,
  global setup/teardown.
- `frontend/playwright.config.ts`: `testIgnore: 'live/**'` (the main suite is unchanged).
- `frontend/e2e/live/global-setup.ts`, `global-teardown.ts`, `preflight.ts`.
- `frontend/e2e/live/sim.ts`: advance, settle, read snapshot, seat correction, set status.
- `frontend/e2e/live/counting-day.spec.ts`: desktop C0–C6, then mobile and light theme.
- `frontend/package.json`: `"e2e:live"`.
- `frontend/.gitignore`: `e2e/artifacts/`.
- `docs/LIVE_RUNBOOK.md` §5 and `docs/FEATURES.md`: how and when to run it.

## 8. First task: refresh the simulation

The simulation predates the reseed, regions and the redesign (testing notes §3.1), though it was used for Phase B.
The first task runs setup + a replay against today's data and fixes what is stale (e.g. a column `sim:setup` does not
copy, the manifest, regions, the picker), each as a small separate fix.

## 9. Bugs the suite finds

Each real dashboard bug found is fixed in the same branch as its own change, with a failing unit or e2e test first.
A finding that is a limitation of the mock (not of the product) is recorded in the runbook instead.

## 10. Out of scope

CI; pixel comparison; slow network, background tab, Render restart, load and admin drills (layers 2–5); the real ECI
adapter; changes to the mock's timeline.
